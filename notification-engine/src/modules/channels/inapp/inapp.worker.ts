import { InappGateway } from './inapp.gateway';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { InappService } from './inapp.service';
import { DeliveryResult } from '@common/interfaces/delivery-result.interface';
import { TemplateService } from '../../template/template.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { DlqService } from '../../delivery/dlq.service';
import { ChannelType } from '@common/enums/channel-type.enum';

@Processor('inapp')
export class InappWorker extends WorkerHost {
  private readonly logger = new Logger(InappWorker.name);

  constructor(
    private readonly inappService: InappService,
    private readonly InappGateway: InappGateway,
    private readonly templateService: TemplateService,
    private readonly delivery: DeliveryService,
    private readonly dlq: DlqService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<DeliveryResult | void> {
    const { event, tenantId, variables, userId, NotificationId } = job.data;

    if (
      await this.delivery.isAlreadyDelivered(NotificationId, ChannelType.INAPP)
    ) {
      this.logger.log(
        `inapp skip (already delivered) notificationId=${NotificationId}`,
      );
      return;
    }

    await this.delivery.markProcessing(
      NotificationId,
      tenantId,
      ChannelType.INAPP,
    );

    const { subject, body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.INAPP,
      variables,
    );
    try {
      const result = await this.inappService.send({
        to: userId,
        subject: subject ?? '',
        body: body ?? '',
      });
      this.InappGateway.emit(userId, {
        subject: subject ?? '',
        body: body ?? '',
      });
      await this.delivery.markDelivered(
        NotificationId,
        ChannelType.INAPP,
        result.messageId,
      );
      return result;
    } catch (err) {
      await this.delivery.markFailed(NotificationId, ChannelType.INAPP, err);
      throw err;
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `inapp completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `inapp failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const permanent = err.name === 'UnrecoverableError';
    if (exhausted || permanent) {
      await this.delivery.markDlq(
        job.data.NotificationId,
        ChannelType.INAPP,
        err,
      );
      await this.dlq.deadLetter(
        job.data,
        ChannelType.INAPP,
        err,
        job.attemptsMade,
      );
    }
  }
}
