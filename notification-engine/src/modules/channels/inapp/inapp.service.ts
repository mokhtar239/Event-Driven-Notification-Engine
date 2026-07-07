import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';
import {
  InappNotification,
  InappNotificationDocument,
} from './schemas/inapp-notification.schema';

@Injectable()
export class InappService implements IChannel {
  private readonly logger = new Logger(InappService.name);

  private readonly failureRate = 0.02;

  constructor(
    @InjectModel(InappNotification.name)
    private readonly model: Model<InappNotificationDocument>,
  ) {}

  async send(payload: ChannelPayload): Promise<DeliveryResult> {
    if (Math.random() < this.failureRate) {
      throw Object.assign(new Error('In-app store temporarily unavailable'), {
        code: 'ECONNRESET',
      });
    }

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
