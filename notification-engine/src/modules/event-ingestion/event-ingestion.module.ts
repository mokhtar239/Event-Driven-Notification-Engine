import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { rabbitMQConfig } from '../../config/rabbitmq.config';
import { EventIngestionConsumer } from './event-ingestion.consumer';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: rabbitMQConfig,
    }),
  ],
  providers: [EventIngestionConsumer],
  exports: [RabbitMQModule],
})
export class EventIngestionModule {}
