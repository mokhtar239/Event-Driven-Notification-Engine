/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
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
  constructor(
    @InjectModel(InappNotification.name)
    private readonly model: Model<InappNotificationDocument>,
  ) {}

  async send(payload: ChannelPayload): Promise<DeliveryResult> {
    const doc = await this.model.create({
      userId: payload.to,
      subject: payload.subject,
      body: payload.body,
      read: false,
    });
    return {
      success: true,
      messageId: doc._id.toString(),
      timestamp: new Date(),
    };
  }
}
