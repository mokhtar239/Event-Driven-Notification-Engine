import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { NotificationEventDto as Event } from '../../common/dto/notification-event.dto';
import { EventRouter } from './event-ingestion.router';
import { DublicateGuardService } from './DublicateGuardService';
import { PreferenceRouter } from '../preferences/preference-router.service';
import { DigestService } from '../digest/digest.service';
import { DigestMode } from '../preferences/schemas/user-preference.schema';
import { ChannelType } from '@common/enums/channel-type.enum';
import {
  Notification,
  NotificationDocument,
} from '../delivery/schemas/notification.schema';
import { NotificationStatus } from '@common/enums/delivery-status.enum';

interface IngestionResult {
  success: boolean;
  correlationId?: string;
  notificationId?: string;
}

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly eventRouter: EventRouter,
    private readonly dublicateGuard: DublicateGuardService,
    private readonly preferenceRouter: PreferenceRouter,
    private readonly digestService: DigestService,
    @InjectModel(Notification.name)
    private readonly notifModel: Model<NotificationDocument>,
  ) {}

  async ingestEvent(
    event: Event,
    correlationId?: string,
  ): Promise<IngestionResult> {
    const loggedEvent = {
      correlationId,
      eventType: event.eventType,
      userId: event.userId,
      tenantId: event.tenantId,
    };

    const route = this.eventRouter.resolve(event.eventType);
    if (!route) {
      this.logger.warn(`Unknown event type: ${event.eventType}`, loggedEvent);
      return { success: false, correlationId };
    }

    const fresh = await this.dublicateGuard.isFresh(event);
    if (!fresh) {
      this.logger.warn(
        `Duplicate event detected: ${event.eventType} for user ${event.userId}`,
        loggedEvent,
      );
      return { success: false, correlationId };
    }

    // Apply user preferences: mute → channel opt-out → quiet hours →
    // priority override. The result is the channels we will actually dispatch.
    const decision = await this.preferenceRouter.route(
      event.tenantId,
      event.userId,
      event.eventType,
      route.channels,
      route.priority,
    );

    // Create the parent Notification doc — its _id is the notificationId used
    // by every channel's DeliveryLog / DeadLetter downstream. `channels`
    // records what we actually intend to deliver after preference filtering.
    const notif = await this.notifModel.create({
      eventType: event.eventType,
      userId: event.userId,
      tenantId: event.tenantId,
      data: event.data ?? {},
      channels: decision.channels,
      status: decision.suppressed
        ? NotificationStatus.SUPPRESSED
        : NotificationStatus.PENDING,
      priority: route.priority,
      correlationId,
    });
    const notificationId = notif._id.toString();

    if (decision.suppressed || decision.channels.length === 0) {
      this.logger.log(
        `Event suppressed: ${event.eventType} for user ${event.userId} ` +
          `reason='${decision.reason ?? 'no eligible channels'}' notificationId=${notificationId}`,
        loggedEvent,
      );
      return { success: true, correlationId, notificationId };
    }

    // Digest diversion: for hourly/daily users, buffer the EMAIL channel into a
    // digest instead of sending now. Other channels still dispatch immediately.
    let channelsToDispatch = decision.channels;
    const isDigest =
      decision.digestMode === DigestMode.HOURLY ||
      decision.digestMode === DigestMode.DAILY;
    const email = event.data?.email as string | undefined;

    if (isDigest && decision.channels.includes(ChannelType.EMAIL) && email) {
      await this.digestService.buffer({
        userId: event.userId,
        tenantId: event.tenantId,
        mode: decision.digestMode,
        eventType: event.eventType,
        notificationId,
        to: email,
        summary: this.summarize(event),
      });
      channelsToDispatch = decision.channels.filter(
        (c) => c !== ChannelType.EMAIL,
      );
      this.logger.log(
        `Email diverted to ${decision.digestMode} digest for user ${event.userId} notificationId=${notificationId}`,
        loggedEvent,
      );
    }

    if (channelsToDispatch.length === 0) {
      return { success: true, correlationId, notificationId };
    }

    await this.eventRouter.dispatch(
      { ...event, correlationId },
      notificationId,
      channelsToDispatch,
      route.priority,
    );

    this.logger.log(
      `Event routed: ${event.eventType} for user ${event.userId} via channels ${channelsToDispatch.join(', ')} notificationId=${notificationId}`,
      loggedEvent,
    );

    return { success: true, correlationId, notificationId };
  }

  /** One-line summary of an event for inclusion in a digest email. */
  private summarize(event: Event): string {
    const data = event.data ?? {};
    const orderId = data.orderId as string | undefined;
    const detail = orderId ? ` (order #${orderId})` : '';
    return `${event.eventType}${detail}`;
  }
}
