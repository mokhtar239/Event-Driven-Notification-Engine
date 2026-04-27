import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('push')
export class PushWorker extends WorkerHost {
  private readonly logger = new Logger(PushWorker.name);

  process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Processing push job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    // firebase admin sdk here
    return Promise.resolve();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `push completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `push failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
  }
}
