import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';

@Injectable()
export class SmsService implements IChannel {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: Twilio;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.client = new Twilio(
      config.getOrThrow<string>('sms.accountSid'),
      config.getOrThrow<string>('sms.authToken'),
    );
    this.from = config.getOrThrow<string>('sms.from');
  }

  async send(payload: ChannelPayload): Promise<DeliveryResult> {
    try {
      const message = await this.client.messages.create({
        from: this.from,
        to: payload.to,
        body: payload.body,
      });
      return { success: true, messageId: message.sid, timestamp: new Date() };
    } catch (err) {
      const error = err as Error;
      this.logger.warn(`Twilio rejected: ${error.message}`);
      return { success: false, error: error.message, timestamp: new Date() };
    }
  }
}
