import { Injectable } from '@nestjs/common';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { EventPriority } from '../../common/enums/event-priority.enum';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';
export interface RouteRule {
  channels: ChannelType[];
  priority: EventPriority;
}

const ROUTING_TABLE: Record<string, RouteRule> = {
  'user.signup': {
    channels: [ChannelType.EMAIL, ChannelType.INAPP],
    priority: EventPriority.NORMAL,
  },
  'order.placed': {
    channels: [ChannelType.EMAIL, ChannelType.SMS, ChannelType.INAPP],
    priority: EventPriority.NORMAL,
  },
  'order.shipped': {
    channels: [ChannelType.SMS, ChannelType.PUSH],
    priority: EventPriority.NORMAL,
  },
  'payment.failed': {
    channels: [ChannelType.EMAIL, ChannelType.SMS],
    priority: EventPriority.HIGH,
  },
  'friend.request': {
    channels: [ChannelType.INAPP],
    priority: EventPriority.LOW,
  },
  'weekly.digest': {
    channels: [ChannelType.EMAIL],
    priority: EventPriority.LOW,
  },
};

@Injectable()
export class EventRouter {
  constructor(
    @InjectQueue('email') private emailQueue: Queue,
    @InjectQueue('sms') private smsQueue: Queue,
    @InjectQueue('push') private pushQueue: Queue,
    @InjectQueue('inapp') private inappQueue: Queue,
  ) {}
  resolve(eventType: string): RouteRule | null {
    return ROUTING_TABLE[eventType] ?? null;
  }
  private pickUpQueue(channel: ChannelType): Queue {
    if (channel === ChannelType.EMAIL) return this.emailQueue;
    else if (channel === ChannelType.SMS) return this.smsQueue;
    else if (channel === ChannelType.PUSH) return this.pushQueue;
    else if (channel === ChannelType.INAPP) return this.inappQueue;
    throw new Error(`No queue for this channel`);
  }

  async dispatch(
    event: NotificationEventDto,
    notificationId: string,
    channels: ChannelType[],
    priority: EventPriority,
  ): Promise<void> {
    for (const channel of channels) {
      const job = {
        NotificationId: notificationId,
        userId: event.userId,
        tenantId: event.tenantId,
        channel,
        event: event.eventType,
        templateId: event.eventType,
        priority,
        metadata: { correlationId: event.correlationId ?? randomUUID() },
        variables: event.data ?? {},
      };
      await this.pickUpQueue(channel).add('send', job, {
        priority,
      });
    }
  }
}
