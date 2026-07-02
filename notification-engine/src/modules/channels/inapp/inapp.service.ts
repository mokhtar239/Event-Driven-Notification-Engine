import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';
import {
  InappNotification,
  InappNotificationDocument,
} from './schemas/inapp-notification.schema';

/**
 * In-app channel. Unlike email/sms/push there is no external provider — the
 * MongoDB write IS the real delivery (source of truth for the offline story),
 * so it is kept real. Only a small transient "infra hiccup" is simulated, and
 * it is thrown BEFORE the write so a failed job never leaves a phantom doc.
 */
@Injectable()
export class InappService implements IChannel {
  private readonly logger = new Logger(InappService.name);

  // ~2% simulated transient failure rate (e.g. DB/network hiccup).
  private readonly failureRate = 0.02;

  constructor(
    @InjectModel(InappNotification.name)
    private readonly model: Model<InappNotificationDocument>,
  ) {}

  async send(payload: ChannelPayload): Promise<DeliveryResult> {
    if (Math.random() < this.failureRate) {
      // Transient: simulate a datastore hiccup so retry/DLQ paths get exercised.
      throw Object.assign(new Error('In-app store temporarily unavailable'), {
        code: 'ECONNRESET',
      });
    }

    // Real delivery: persist the notification (kept, never simulated away).
    const doc = await this.model.create({
      userId: payload.to,
      subject: payload.subject,
      body: payload.body,
      read: false,
    });

    this.logger.log(
      `[SIMULATED] In-app stored userId=${payload.to} id=${doc._id.toString()}`,
    );

    return {
      success: true,
      messageId: doc._id.toString(),
      timestamp: new Date(),
    };
  }
}
