import { EmailService } from './emailService';
import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(private readonly emailService: EmailService) {
    super();
  }
  async process(job: Job<NotificationJobData>): Promise<void> {
    this.logger.log(
      `Processing email job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    await this.emailService.send({
      to: job.data.variables.email,
      subject: job.data.variables.subject,
      body: job.data.variables.body,
    });
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `email completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `email failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
  }
}
