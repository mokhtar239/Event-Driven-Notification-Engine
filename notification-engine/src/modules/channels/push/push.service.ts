import { Injectable, Logger } from '@nestjs/common';
import CircuitBreaker from 'opossum';
import { IChannel, ChannelPayload } from '@common/interfaces/channel.interface';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';
import { makeBreaker } from '@common/resilience/circuit-breaker';

@Injectable()
export class PushService implements IChannel {
  private readonly logger = new Logger(PushService.name);

  private readonly failureRate = 0.03;

  private readonly breaker: CircuitBreaker<[ChannelPayload], DeliveryResult>;

  constructor() {
    this.breaker = makeBreaker((p: ChannelPayload) => this.doSend(p), {
      name: 'push',
    });
    this.breaker.on('open', () =>
      this.logger.warn('[BREAKER] push circuit OPEN — fast-failing'),
    );
    this.breaker.on('halfOpen', () =>
      this.logger.log('[BREAKER] push circuit HALF-OPEN — probing'),
    );
    this.breaker.on('close', () =>
      this.logger.log('[BREAKER] push circuit CLOSED — recovered'),
    );
  }

  send(payload: ChannelPayload): Promise<DeliveryResult> {
    return this.breaker.fire(payload);
  }

  private async doSend(payload: ChannelPayload): Promise<DeliveryResult> {
    await this.simulateLatency();

    if (!payload.to || payload.to.length < 10) {
      throw Object.assign(new Error('Invalid registration token'), {
        code: 'messaging/invalid-registration-token',
      });
    }

    if (Math.random() < this.failureRate) {
      throw Object.assign(new Error('FCM server unavailable'), {
        code: 'messaging/server-unavailable',
      });
    }

    const messageId = `projects/sim/messages/${this.randomHex(24)}`;
    this.logger.log(
      `[SIMULATED] Push sent token=${payload.to.slice(0, 8)}… id=${messageId}`,
    );

    return { success: true, messageId, timestamp: new Date() };
  }

  private simulateLatency(): Promise<void> {
    const ms = 30 + Math.floor(Math.random() * 70);
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private randomHex(len: number): string {
    let out = '';
    while (out.length < len) out += Math.random().toString(16).slice(2);
    return out.slice(0, len);
  }
}
