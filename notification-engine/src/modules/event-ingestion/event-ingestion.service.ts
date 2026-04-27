import { Injectable, Logger } from '@nestjs/common';
import { NotificationEventDto as Event } from '../../common/dto/notification-event.dto';
import { EventRouter } from './event-ingestion.router';
import { DublicateGuardService } from './DublicateGuardService';
import { randomUUID } from 'crypto';

interface IngestionResult {
  success: boolean;
  correlationId?: string;
}

@Injectable()
export class EventIngestionService {
  private readonly logger = new Logger(EventIngestionService.name);

  constructor(
    private readonly eventRouter: EventRouter,
    private readonly dublicateGuard: DublicateGuardService,
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

    const notificationId: string = randomUUID();
    await this.eventRouter.dispatch(
      { ...event, correlationId },
      notificationId,
    );

    this.logger.log(
      `Event routed: ${event.eventType} for user ${event.userId} via channels ${route.channels.join(', ')}`,
      loggedEvent,
    );

    return { success: true, correlationId };
  }
}
