import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import {
  DeliveryStatus,
  NotificationStatus,
} from '@common/enums/delivery-status.enum';
import {
  DeliveryLog,
  DeliveryLogDocument,
} from './schemas/delivery-log.schema';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class DeliveryService {
  private readonly logger = new Logger(DeliveryService.name);

  constructor(
    @InjectModel(DeliveryLog.name)
    private readonly logModel: Model<DeliveryLogDocument>,
    @InjectModel(Notification.name)
    private readonly notifModel: Model<NotificationDocument>,
  ) {}

  private oid(id: string): Types.ObjectId {
    return new Types.ObjectId(id);
  }

  async markProcessing(
    notificationId: string,
    tenantId: string,
    channel: ChannelType,
  ): Promise<void> {
    await this.logModel.updateOne(
      { notificationId: this.oid(notificationId), channel },
      {
        $set: { status: DeliveryStatus.PROCESSING, tenantId },
        $inc: { attempts: 1 },
        $setOnInsert: { notificationId: this.oid(notificationId), channel },
      },
      { upsert: true },
    );
  }

  async markDelivered(
    notificationId: string,
    channel: ChannelType,
    externalMessageId?: string,
  ): Promise<void> {
    await this.logModel.updateOne(
      { notificationId: this.oid(notificationId), channel },
      {
        $set: {
          status: DeliveryStatus.DELIVERED,
          deliveredAt: new Date(),
          externalMessageId,
        },
      },
    );
    await this.rollupNotification(notificationId);
  }

  async markFailed(
    notificationId: string,
    channel: ChannelType,
    error: unknown,
  ): Promise<void> {
    await this.logModel.updateOne(
      { notificationId: this.oid(notificationId), channel },
      { $set: { status: DeliveryStatus.FAILED, lastError: this.msg(error) } },
    );
  }

  async markDlq(
    notificationId: string,
    channel: ChannelType,
    error: unknown,
  ): Promise<void> {
    await this.logModel.updateOne(
      { notificationId: this.oid(notificationId), channel },
      { $set: { status: DeliveryStatus.DLQ, lastError: this.msg(error) } },
    );
    await this.rollupNotification(notificationId);
  }

  async isAlreadyDelivered(
    notificationId: string,
    channel: ChannelType,
  ): Promise<boolean> {
    const existing = await this.logModel
      .findOne({
        notificationId: this.oid(notificationId),
        channel,
        status: DeliveryStatus.DELIVERED,
      })
      .lean();
    return !!existing;
  }

  async rollupNotification(notificationId: string): Promise<void> {
    const notif = await this.notifModel
      .findById(this.oid(notificationId))
      .lean();
    if (!notif) return;

    const logs = await this.logModel
      .find({ notificationId: this.oid(notificationId) })
      .lean();

    const expected = notif.channels.length;
    const delivered = logs.filter(
      (l) => l.status === DeliveryStatus.DELIVERED,
    ).length;
    const settled = logs.filter((l) =>
      [
        DeliveryStatus.DELIVERED,
        DeliveryStatus.FAILED,
        DeliveryStatus.DLQ,
      ].includes(l.status),
    ).length;

    let status: NotificationStatus;
    if (settled < expected) {
      status = NotificationStatus.PROCESSING;
    } else if (delivered === expected) {
      status = NotificationStatus.SENT;
    } else if (delivered === 0) {
      status = NotificationStatus.FAILED;
    } else {
      status = NotificationStatus.PARTIAL;
    }

    await this.notifModel.updateOne(
      { _id: this.oid(notificationId) },
      { $set: { status } },
    );
  }

  async getStats(
    filter: {
      tenantId?: string;
      from?: Date;
      to?: Date;
    } = {},
  ): Promise<ChannelStats[]> {
    const match: Record<string, unknown> = {};
    if (filter.tenantId) match.tenantId = filter.tenantId;
    if (filter.from || filter.to) {
      const range: Record<string, Date> = {};
      if (filter.from) range.$gte = filter.from;
      if (filter.to) range.$lte = filter.to;
      match.createdAt = range;
    }

    const rows = await this.logModel.aggregate<{
      _id: ChannelType;
      total: number;
      delivered: number;
      failed: number;
      dlq: number;
      avgDeliveryMs: number | null;
    }>([
      { $match: match },
      {
        $group: {
          _id: '$channel',
          total: { $sum: 1 },
          delivered: {
            $sum: {
              $cond: [{ $eq: ['$status', DeliveryStatus.DELIVERED] }, 1, 0],
            },
          },
          failed: {
            $sum: {
              $cond: [{ $eq: ['$status', DeliveryStatus.FAILED] }, 1, 0],
            },
          },
          dlq: {
            $sum: {
              $cond: [{ $eq: ['$status', DeliveryStatus.DLQ] }, 1, 0],
            },
          },
          avgDeliveryMs: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$status', DeliveryStatus.DELIVERED] },
                    { $ne: ['$deliveredAt', null] },
                  ],
                },
                { $subtract: ['$deliveredAt', '$createdAt'] },
                null,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return rows.map((r) => {
      const deliveryRate = r.total ? r.delivered / r.total : 0;
      const failureRate = r.total ? (r.failed + r.dlq) / r.total : 0;
      return {
        channel: r._id,
        total: r.total,
        delivered: r.delivered,
        failed: r.failed,
        dlq: r.dlq,
        deliveryRate: Number(deliveryRate.toFixed(4)),
        failureRate: Number(failureRate.toFixed(4)),
        avgDeliveryMs:
          r.avgDeliveryMs != null ? Math.round(r.avgDeliveryMs) : null,
      };
    });
  }

  private msg(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return 'unknown error';
  }
}

export interface ChannelStats {
  channel: ChannelType;
  total: number;
  delivered: number;
  failed: number;
  dlq: number;
  deliveryRate: number;
  failureRate: number;
  avgDeliveryMs: number | null;
}
