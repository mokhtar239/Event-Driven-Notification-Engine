import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';
import { EventIngestionService } from './event-ingestion.service';

@ApiTags('events')
@Controller('events')
export class EventIngestionController {
  constructor(private readonly eventIngestionService: EventIngestionService) {}

  @Post('publish')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Publish a domain event for notification processing',
    description:
      'Resolves the event to channels/priority, applies user preferences, ' +
      'and dispatches per-channel delivery jobs. Idempotent per ' +
      '(eventType, userId, occurredAt) for 24h.',
  })
  @ApiBody({
    type: NotificationEventDto,
    examples: {
      orderPlaced: {
        summary: 'order.placed (email + SMS + in-app)',
        value: {
          eventType: 'order.placed',
          userId: '11111111-1111-4111-8111-111111111111',
          tenantId: '22222222-2222-4222-8222-222222222222',
          data: {
            orderId: 'A-1001',
            firstName: 'Ada',
            total: 42.5,
            email: 'ada@example.com',
          },
        },
      },
      paymentFailed: {
        summary: 'payment.failed (HIGH — bypasses quiet hours)',
        value: {
          eventType: 'payment.failed',
          userId: '11111111-1111-4111-8111-111111111111',
          tenantId: '22222222-2222-4222-8222-222222222222',
          data: { orderId: 'A-1001', reason: 'card_declined' },
        },
      },
    },
  })
  @ApiAcceptedResponse({
    description: 'Event accepted for processing.',
    schema: {
      example: {
        success: true,
        notificationId: '665f1b2c9a1e4c0012ab34cd',
        correlationId: '9f0c8b7a-1234-4d56-8e90-abcdef012345',
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed.',
    schema: {
      example: {
        statusCode: 400,
        message: ['userId must be a UUID'],
        error: 'Bad Request',
      },
    },
  })
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
