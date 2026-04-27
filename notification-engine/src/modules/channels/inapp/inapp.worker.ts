import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('inapp')
export class InappWorker extends WorkerHost {
  private logger = new Logger('InappWorker');
  process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Would deliver in-app for ${job.data.event} to user ${job.data.userId}`,
    );
    return Promise.resolve();
  }
}
