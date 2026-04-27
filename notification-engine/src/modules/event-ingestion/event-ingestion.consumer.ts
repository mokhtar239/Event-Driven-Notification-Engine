import { EventIngestionService } from './event-ingestion.service';
import { Injectable, Logger } from '@nestjs/common';
import { Nack, RabbitSubscribe } from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import {
  EVENT_DLQ,
  EVENT_DLX,
  EVENT_EXCHANGE,
  EVENT_MAIN_QUEUE,
} from '../../config/rabbitmq.config';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';
import { plainToInstance } from 'class-transformer';
import { validateOrReject } from 'class-validator';
import { randomUUID } from 'crypto';

@Injectable()
export class EventIngestionConsumer {
  constructor(private readonly eventIngestionService: EventIngestionService) {}
  private readonly logger = new Logger(EventIngestionConsumer.name);

  @RabbitSubscribe({
    exchange: EVENT_EXCHANGE,
    routingKey: ['order.*', 'payment.*', 'user.*'],
    queue: EVENT_MAIN_QUEUE,
    queueOptions: {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EVENT_DLX,
        'x-dead-letter-routing-key': 'dlq',
      },
    },
  })
  async handleEvent(msg: unknown, amqpMsg: ConsumeMessage) {
    const routingKey = amqpMsg.fields.routingKey;
    const dto = plainToInstance(NotificationEventDto, msg);

    try {
      await validateOrReject(dto);
    } catch (error) {
      this.logger.error(
        `Validation failed for message rk=${routingKey}: ${JSON.stringify(msg)}. Error: ${error}`,
      );
      return new Nack(false);
    }

    const correlationId = dto.correlationId ?? randomUUID();
    try {
      await this.eventIngestionService.ingestEvent(dto, correlationId);
    } catch (err) {
      this.logger.error(
        `Ingest failed rk=${routingKey} correlationId=${correlationId}: ${(err as Error).message}`,
      );
      return new Nack(false);
    }
  }

  @RabbitSubscribe({
    exchange: EVENT_DLX,
    routingKey: '#',
    queue: EVENT_DLQ,
    queueOptions: { durable: true },
  })
  async handleDead(msg: unknown, amqpMsg: ConsumeMessage) {
    this.logger.warn(
      `DLQ message rk=${amqpMsg.fields.routingKey}: ${JSON.stringify(msg)}`,
    );
  }
}
