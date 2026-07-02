import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';
import { makeBreaker } from '@common/resilience/circuit-breaker';

/**
 * Simulated SMS channel. Mimics the shape of a Twilio client without making
 * real network calls. Failures throw errors carrying a numeric `code` so that
 * `throwClassifiedSms` can distinguish permanent vs. transient.
 *
 * The external call is wrapped in an opossum circuit breaker so a sustained
 * provider outage fast-fails instead of hammering the provider.
 */
@Injectable()
export class SmsService implements IChannel {
  private readonly logger = new Logger(SmsService.name);

  // ~3% simulated transient failure rate.
  private readonly failureRate = 0.03;

  private readonly breaker: CircuitBreaker<[ChannelPayload], DeliveryResult>;

  constructor() {
    this.breaker = makeBreaker((p: ChannelPayload) => this.doSend(p), {
      name: 'sms',
    });
    this.breaker.on('open', () =>
      this.logger.warn('[BREAKER] sms circuit OPEN — fast-failing'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.log('[BREAKER] sms circuit HALF-OPEN — probing'),
    );
    this.breaker.on('close', () =>
      this.logger.log('[BREAKER] sms circuit CLOSED — recovered'),
    );
  }

  send(payload: ChannelPayload): Promise<DeliveryResult> {
    return this.breaker.fire(payload);
  }

  private async doSend(payload: ChannelPayload): Promise<DeliveryResult> {
    await this.simulateLatency();

    if (!payload.to || !/^\+?[1-9]\d{6,14}$/.test(payload.to)) {
      // Permanent: invalid 'To' number (Twilio code 21211).
      throw Object.assign(new Error(`Invalid 'To' number: ${payload.to}`), {
        code: 21211,
      });
    }

    if (Math.random() < this.failureRate) {
      // Transient: simulate a 503 from the provider.
      throw Object.assign(new Error('SMS provider temporarily unavailable'), {
        statusCode: 503,
      });
    }

    const messageId = `SM${this.randomHex(32)}`;
    this.logger.log(`[SIMULATED] SMS sent to=${payload.to} sid=${messageId}`);

    return { success: true, messageId, timestamp: new Date() };
  }

  private simulateLatency(): Promise<void> {
    const ms = 40 + Math.floor(Math.random() * 80);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomHex(len: number): string {
    let out = '';
    while (out.length < len) out += Math.random().toString(16).slice(2);
    return out.slice(0, len);
  }
}
