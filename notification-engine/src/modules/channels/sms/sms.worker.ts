import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { SmsService } from './sms.service';
import { TemplateService } from '../../template/template.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { DlqService } from '../../delivery/dlq.service';
import { ChannelType } from '@common/enums/channel-type.enum';
import { throwClassifiedSms } from './sms.errors';

@Processor('sms')
export class SmsWorker extends WorkerHost {
  private readonly logger = new Logger(SmsWorker.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly templateService: TemplateService,
    private readonly delivery: DeliveryService,
    private readonly dlq: DlqService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, tenantId, variables, NotificationId } = job.data;

    // Idempotency guard: skip if this (notification, channel) already delivered.
    if (
      await this.delivery.isAlreadyDelivered(NotificationId, ChannelType.SMS)
    ) {
      this.logger.log(
        `sms skip (already delivered) notificationId=${NotificationId}`,
      );
      return;
    }

    await this.delivery.markProcessing(
      NotificationId,
      tenantId,
      ChannelType.SMS,
    );

    const { body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.SMS,
      variables,
    );
    try {
      const result = await this.smsService.send({
        to: variables.phone,
        body: body ?? '',
      });
      await this.delivery.markDelivered(
        NotificationId,
        ChannelType.SMS,
        result.messageId,
      );
    } catch (err) {
      await this.delivery.markFailed(NotificationId, ChannelType.SMS, err);
      throwClassifiedSms(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `sms completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `sms failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const permanent = err.name === 'UnrecoverableError';
    if (exhausted || permanent) {
      await this.delivery.markDlq(
        job.data.NotificationId,
        ChannelType.SMS,
        err,
      );
      await this.dlq.deadLetter(
        job.data,
        ChannelType.SMS,
        err,
        job.attemptsMade,
      );
    }
  }
}
