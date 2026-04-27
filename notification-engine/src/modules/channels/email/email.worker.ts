import { Logger } from '@nestjs/common';
import { WorkerHost, Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);
  process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Processing email job for NotificationId: ${job.data.NotificationId}`,
    );
    return Promise.resolve();
    // node mailer here
  }
}
