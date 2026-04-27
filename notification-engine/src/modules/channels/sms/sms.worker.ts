import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('sms')
export class SmsWorker extends WorkerHost {
  private logger = new Logger('SmsWorker');
  process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Would send SMS for ${job.data.event} to user ${job.data.userId}`,
    );
    return Promise.resolve();
  }
}
