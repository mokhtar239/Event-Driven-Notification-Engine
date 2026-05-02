import { InappGateway } from './inapp.gateway';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { InappService } from './inapp.service';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';

@Processor('inapp')
export class InappWorker extends WorkerHost {
  private readonly logger = new Logger(InappWorker.name);

  constructor(
    private readonly inappService: InappService,
    private readonly InappGateway: InappGateway,
  ) {
    super();
  }
  async process(job: Job<NotificationJobData>): Promise<DeliveryResult> {
    this.logger.log(
      `Processing inapp job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    const { title, body } = job.data.variables;
    const result = await this.inappService.send({
      to: job.data.userId,
      subject: title,
      body,
    });
    if (!result.success) {
      throw new Error(
        `Failed to send inapp notification for notificationId=${job.data.NotificationId}`,
      );
    }
    this.InappGateway.emit(job.data.userId, { subject: title, body });
    return result;
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
