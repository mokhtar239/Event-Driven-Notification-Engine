import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import {
  DigestBatch,
  DigestBatchSchema,
} from './schemas/digest-batch.schema';
import { DigestService } from './digest.service';
import { DigestCron } from './digest.cron';
import { EmailService } from '../channels/email/emailService';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: DigestBatch.name, schema: DigestBatchSchema },
    ]),
  ],
  providers: [DigestService, DigestCron, EmailService],
  exports: [DigestService],
})
export class DigestModule {}
