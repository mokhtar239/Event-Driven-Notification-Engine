import { Injectable, Logger } from '@nestjs/common';
import { NotificationEventDto as Event } from '../../common/dto/notification-event.dto';
import { EventRouter } from './event-ingestion.router';
import { DublicateGuardService } from './DublicateGuardService';

interface IngestionResult {
  success: boolean;
  state: 'DUBLICATE' | 'ROUTED' | 'UNKNOWN_TYPE';
}

@Injectable()
export class EventIngestionService {
  private readonly Logger = new Logger(EventIngestionService.name);

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

    // check if event is not known
    const Route = this.eventRouter.resolve(event.eventType);
    if (!Route) {
      this.Logger.warn(`Unknown event type: ${event.eventType}`, loggedEvent);
      return { success: false, state: 'UNKNOWN_TYPE' };
    }

    // check if event is dublicate
    const fresh = await this.dublicateGuard.isFresh(event);
    if (!fresh) {
      this.Logger.warn(
        `Dublicate event detected: ${event.eventType} for user ${event.userId}`,
        loggedEvent,
      );
      return { success: false, state: 'DUBLICATE' };
    }

    // route event to channels
    this.Logger.log(
      `Event routed: ${event.eventType} for user ${event.userId} via channels ${Route.channels.join(', ')}`,
      loggedEvent,
    );

    // route Events Here

    return { success: true, state: 'ROUTED' };
  }
}