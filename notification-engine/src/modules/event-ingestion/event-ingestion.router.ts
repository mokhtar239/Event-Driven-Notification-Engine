import { Injectable } from '@nestjs/common';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { EventPriority } from '../../common/enums/event-priority.enum';

interface RouteRule {
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
  resolve(eventType: string): RouteRule {
    return ROUTING_TABLE[eventType] ?? null;
  }
}
