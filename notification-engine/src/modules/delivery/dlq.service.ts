import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Model, Types } from 'mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import { NotificationJobData } from '@common/interfaces/notification-job.interface';
import { DeadLetter, DeadLetterDocument } from './schemas/dead-letter.schema';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @InjectModel(DeadLetter.name)
    private readonly dlqModel: Model<DeadLetterDocument>,
    @InjectQueue(ChannelType.EMAIL) private readonly emailQueue: Queue,
    @InjectQueue(ChannelType.SMS) private readonly smsQueue: Queue,
    @InjectQueue(ChannelType.PUSH) private readonly pushQueue: Queue,
    @InjectQueue(ChannelType.INAPP) private readonly inappQueue: Queue,
  ) {}

  private queueFor(channel: ChannelType): Queue {
    switch (channel) {
      case ChannelType.EMAIL:
        return this.emailQueue;
      case ChannelType.SMS:
        return this.smsQueue;
      case ChannelType.PUSH:
        return this.pushQueue;
      case ChannelType.INAPP:
        return this.inappQueue;
      default:
        throw new Error(`No queue for channel ${String(channel)}`);
    }
  }

  async deadLetter(
    payload: NotificationJobData,
    channel: ChannelType,
    error: unknown,
    attempts: number,
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.dlqModel.create({
      notificationId: new Types.ObjectId(payload.NotificationId),
      tenantId: payload.tenantId,
      channel,
      payload,
      error: message,
      attempts,
    });

    this.logger.warn(
      `[DLQ-ALERT] notificationId=${payload.NotificationId} channel=${channel} attempts=${attempts}: ${message}`,
    );
  }

  async list(filter: { tenantId?: string; channel?: ChannelType } = {}) {
    const query: Record<string, unknown> = { replayed: false };
    if (filter.tenantId) query.tenantId = filter.tenantId;
    if (filter.channel) query.channel = filter.channel;
    return this.dlqModel.find(query).sort({ createdAt: -1 }).limit(200).lean();
  }

  async replay(id: string) {
    const entry = await this.dlqModel.findById(id);
    if (!entry) throw new NotFoundException(`DLQ entry ${id} not found`);

    await this.queueFor(entry.channel).add('send', entry.payload, {
      priority: entry.payload.priority,
    });

    entry.replayed = true;
    await entry.save();
    this.logger.log(`Replayed DLQ entry ${id} to ${entry.channel} queue`);
    return { replayed: true, id, channel: entry.channel };
  }

  async discard(id: string) {
    const res = await this.dlqModel.findByIdAndDelete(id).lean();
    if (!res) throw new NotFoundException(`DLQ entry ${id} not found`);
    return { discarded: true, id };
  }
}
