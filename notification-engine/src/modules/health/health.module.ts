import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { EventIngestionModule } from '../event-ingestion/event-ingestion.module';

@Module({
  imports: [EventIngestionModule],
  controllers: [HealthController],
})
export class HealthModule {}
