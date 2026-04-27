import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('inapp')
export class InappWorker extends WorkerHost {
  private readonly logger = new Logger(InappWorker.name);

  process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Processing inapp job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    // socket.io gateway here
    return Promise.resolve();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `inapp completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `inapp failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
  }
}
