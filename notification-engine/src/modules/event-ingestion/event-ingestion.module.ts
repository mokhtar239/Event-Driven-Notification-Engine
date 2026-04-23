import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import Redis from 'ioredis';
import { rabbitMQConfig } from '../../config/rabbitmq.config';
import { EventIngestionConsumer } from './event-ingestion.consumer';
import { EventIngestionController } from './event-ingestion.controller';
import { EventIngestionService } from './event-ingestion.service';
import { EventRouter } from './event-ingestion.router';
import { DublicateGuardService } from './DublicateGuardService';

@Module({
  imports: [
    RabbitMQModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: rabbitMQConfig,
    }),
  ],
  controllers: [EventIngestionController],
  providers: [
    EventIngestionConsumer,
    EventIngestionService,
    EventRouter,
    DublicateGuardService,
    {
      provide: 'REDIS',
      useFactory: (cfg: ConfigService) =>
        new Redis({
          host: cfg.get<string>('REDIS_HOST'),
          port: cfg.get<number>('REDIS_PORT'),
        }),
      inject: [ConfigService],
    },
  ],
  exports: [RabbitMQModule, EventIngestionService],
})
export class EventIngestionModule {}
