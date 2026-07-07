import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';
import { makeBreaker } from '@common/resilience/circuit-breaker';

@Injectable()
export class EmailService implements IChannel {
  private readonly logger = new Logger(EmailService.name);

  private readonly failureRate = 0.03;

  private readonly breaker: CircuitBreaker<[ChannelPayload], DeliveryResult>;

  constructor() {
    this.breaker = makeBreaker((p: ChannelPayload) => this.doSend(p), {
      name: 'email',
    });
    this.breaker.on('open', () =>
      this.logger.warn('[BREAKER] email circuit OPEN — fast-failing'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.log('[BREAKER] email circuit HALF-OPEN — probing'),
    );
    this.breaker.on('close', () =>
      this.logger.log('[BREAKER] email circuit CLOSED — recovered'),
    );
  }

  send(payload: ChannelPayload): Promise<DeliveryResult> {
    return this.breaker.fire(payload);
  }

  private async doSend(payload: ChannelPayload): Promise<DeliveryResult> {
    await this.simulateLatency();

    if (!payload.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(payload.to)) {
      throw Object.assign(new Error(`Invalid 'to' address: ${payload.to}`), {
        name: 'validation_error',
        statusCode: 422,
      });
    }

    if (Math.random() < this.failureRate) {
      throw Object.assign(new Error('Email provider temporarily unavailable'), {
        name: 'application_error',
        statusCode: 503,
      });
    }

    const messageId = this.randomUuid();
    this.logger.log(`[SIMULATED] Email sent to=${payload.to} id=${messageId}`);

    return { success: true, messageId, timestamp: new Date() };
  }

  private simulateLatency(): Promise<void> {
    const ms = 50 + Math.floor(Math.random() * 100);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomUuid(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
