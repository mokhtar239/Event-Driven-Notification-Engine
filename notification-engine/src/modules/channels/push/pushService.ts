import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';

@Injectable()
export class PushService implements IChannel {
  private readonly logger = new Logger(PushService.name);
  private readonly app: admin.app.App;
  private readonly dryRun: boolean;

  constructor(config: ConfigService) {
    const json = config.getOrThrow<string>('push.serviceAccountJson');
    this.dryRun = config.get<boolean>('push.dryRun') ?? true;
    const credential = admin.credential.cert(
      JSON.parse(json) as admin.ServiceAccount,
    );
    this.app = admin.apps.length
      ? admin.app()
      : admin.initializeApp({ credential });
  }

  async send(payload: ChannelPayload): Promise<DeliveryResult> {
    try {
      const messageId = await this.app.messaging().send(
        {
          token: payload.to,
          notification: { title: payload.subject ?? '', body: payload.body },
        },
        this.dryRun,
      );
      return { success: true, messageId, timestamp: new Date() };
    } catch (err) {
      const error = err as { code?: string; message?: string };
      this.logger.warn(
        `FCM rejected: ${error.code ?? ''} ${error.message ?? ''}`,
      );
      // Re-throw the original error so the worker's classifier can read errorInfo.code / code.
      throw err;
    }
  }
}
