import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('sms')
export class SmsWorker extends WorkerHost {
  private readonly logger = new Logger(SmsWorker.name);

  process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Processing sms job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    // twilio here
    return Promise.resolve();
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `sms completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `sms failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
  }
}
