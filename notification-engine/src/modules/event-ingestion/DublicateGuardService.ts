import { Injectable, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { NotificationEventDto as Event } from '../../common/dto/notification-event.dto';

@Injectable()
export class DublicateGuardService {
  constructor(@Inject('REDIS') private readonly redis: Redis) {}

  private generateKey(event: Event): string {
    const text = `${event.eventType}:${event.userId}:${event.occurredAt ?? ''}:${JSON.stringify(event.data ?? {})}`;
    const key = `seen:${createHash('sha256').update(text).digest('hex')}`;
    return key;
  }

  async isFresh(event: Event, TTLSeconds = 86400): Promise<boolean> {
    const key = this.generateKey(event);
    const isfresh = await this.redis.set(key, '1', 'EX', TTLSeconds, 'NX');
    return isfresh === 'OK';
  }
}
