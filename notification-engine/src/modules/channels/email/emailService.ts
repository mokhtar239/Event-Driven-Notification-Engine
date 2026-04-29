import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';

@Injectable()
export class EmailService implements IChannel {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.client = new Resend(config.getOrThrow<string>('RESEND_API_KEY'));
    this.from = config.getOrThrow<string>('EMAIL_FROM');
  }

  async send(payload: ChannelPayload): Promise<DeliveryResult> {
    const { data, error } = await this.client.emails.send({
      from: this.from,
      to: payload.to,
      subject: payload.subject ?? '(no subject)',
      html: payload.body,
    });

    if (error) {
      this.logger.warn(`Resend rejected: ${error.message}`);
      return { success: false, error: error.message, timestamp: new Date() };
    }

    return { success: true, messageId: data.id, timestamp: new Date() };
  }
}
