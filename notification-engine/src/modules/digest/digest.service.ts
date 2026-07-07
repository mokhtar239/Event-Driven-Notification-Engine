import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { EmailService } from '../channels/email/emailService';
import { DigestMode } from '../preferences/schemas/user-preference.schema';
import {
  DigestBatch,
  DigestBatchDocument,
  DigestItemStatus,
} from './schemas/digest-batch.schema';

export interface DigestItemInput {
  userId: string;
  tenantId: string;
  mode: DigestMode;
  eventType: string;
  notificationId?: string;
  summary: string;
  to: string;
}

@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    @InjectModel(DigestBatch.name)
    private readonly batchModel: Model<DigestBatchDocument>,
    private readonly email: EmailService,
  ) {}

  async buffer(item: DigestItemInput): Promise<void> {
    await this.batchModel.create({
      userId: item.userId,
      tenantId: item.tenantId,
      mode: item.mode,
      eventType: item.eventType,
      notificationId: item.notificationId,
      to: item.to,
      summary: item.summary,
      status: DigestItemStatus.PENDING,
    });
    this.logger.log(
      `Digest buffered: user=${item.userId} mode=${item.mode} event=${item.eventType}`,
    );
  }

  async flush(mode: DigestMode): Promise<number> {
    const pending = await this.batchModel
      .find({ mode, status: DigestItemStatus.PENDING })
      .sort({ createdAt: 1 })
      .lean();

    if (pending.length === 0) {
      this.logger.log(`Digest flush (${mode}): nothing pending`);
      return 0;
    }

    const groups = new Map<string, typeof pending>();
    for (const item of pending) {
      const key = `${item.tenantId}::${item.userId}`;
      const arr = groups.get(key) ?? [];
      arr.push(item);
      groups.set(key, arr);
    }

    let sent = 0;
    for (const [key, items] of groups) {
      const [, userId] = key.split('::');
      const to = items[0].to;
      const ids = items.map((i) => i._id as Types.ObjectId);

      const body = this.renderDigest(mode, items);
      try {
        await this.email.send({
          to,
          subject: this.subjectFor(mode, items.length),
          body,
        });
        await this.markSent(ids);
        sent++;
        this.logger.log(
          `Digest sent: user=${userId} mode=${mode} items=${items.length}`,
        );
      } catch (err) {
        this.logger.error(
          `Digest send failed: user=${userId} mode=${mode}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return sent;
  }

  private async markSent(ids: Types.ObjectId[]): Promise<void> {
    await this.batchModel.updateMany(
      { _id: { $in: ids } },
      { $set: { status: DigestItemStatus.SENT, sentAt: new Date() } },
    );
  }

  private subjectFor(mode: DigestMode, count: number): string {
    const label = mode === DigestMode.DAILY ? 'daily' : 'hourly';
    return `Your ${label} digest — ${count} update${count === 1 ? '' : 's'}`;
  }

  private renderDigest(
    mode: DigestMode,
    items: { summary: string; eventType: string }[],
  ): string {
    const label = mode === DigestMode.DAILY ? 'today' : 'this hour';
    const lines = items.map((i) => `• ${i.summary}`).join('\n');
    return `Here's what you missed ${label}:\n\n${lines}\n\nYou received this because your notification preference is set to ${mode} digest.`;
  }
}
