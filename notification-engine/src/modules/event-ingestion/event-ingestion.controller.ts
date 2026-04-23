import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';
import { EventIngestionService } from './event-ingestion.service';

@Controller('events')
export class EventIngestionController {
  constructor(private readonly eventIngestionService: EventIngestionService) {}

  @Post('publish')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestEvent(@Body() event: NotificationEventDto) {
    const correlationId = event.correlationId ?? randomUUID();
    const result = await this.eventIngestionService.ingestEvent(
      event,
      correlationId,
    );
    return {
      ...result,
      correlationId,
    };
  }
  
}
