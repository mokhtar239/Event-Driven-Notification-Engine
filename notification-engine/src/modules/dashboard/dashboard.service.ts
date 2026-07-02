import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from '../delivery/schemas/notification.schema';
import {
  DeliveryService,
  ChannelStats,
} from '../delivery/delivery.service';

export interface UserHistoryPage {
  userId: string;
  page: number;
  limit: number;
  total: number;
  items: NotificationDocument[];
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notifModel: Model<NotificationDocument>,
    private readonly delivery: DeliveryService,
  ) {}

  stats(filter: {
    tenantId?: string;
    from?: Date;
    to?: Date;
  }): Promise<ChannelStats[]> {
    return this.delivery.getStats(filter);
  }

  async userHistory(
    userId: string,
    opts: { tenantId?: string; page?: number; limit?: number } = {},
  ): Promise<UserHistoryPage> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
    const query: Record<string, unknown> = { userId };
    if (opts.tenantId) query.tenantId = opts.tenantId;

    const [items, total] = await Promise.all([
      this.notifModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      this.notifModel.countDocuments(query),
    ]);

    return { userId, page, limit, total, items: items as NotificationDocument[] };
  }
}
