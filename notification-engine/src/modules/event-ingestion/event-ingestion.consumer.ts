import { Injectable, Logger } from '@nestjs/common';
import {Nack,RabbitSubscribe}from '@golevelup/nestjs-rabbitmq';
import { ConsumeMessage } from 'amqplib';
import {
  EVENT_DLQ,
  EVENT_DLX,
  EVENT_EXCHANGE,
  EVENT_MAIN_QUEUE,
} from '../../config/rabbitmq.config';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';

@Injectable()
export class EventIngestionConsumer {
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
  async handleEvent(msg: NotificationEventDto, amqpMsg: ConsumeMessage) {
    const routingKey = amqpMsg.fields.routingKey;
    try {
      if (!msg.eventType || !msg.userId) {
        this.logger.warn(`Invalid payload on ${routingKey}: missing fields`);
        return new Nack(false); // remove from queue immediately
      }

      this.logger.log(
        `Received event ${msg.eventType} (rk=${routingKey}) for user=${msg.userId}`,
      );
      // TODO : validate schema -> route to channel queues

      return;
    } catch (error) {

      this.logger.error(
        `Error processing message on ${routingKey}: ${(error as Error).message}`,
      );
      return new Nack(true); // requeue
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
