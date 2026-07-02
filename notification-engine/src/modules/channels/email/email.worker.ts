import { EmailService } from './emailService';
import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { TemplateService } from '../../template/template.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { DlqService } from '../../delivery/dlq.service';
import { ChannelType } from '@common/enums/channel-type.enum';
import { throwClassifiedEmail } from './email.errors';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly delivery: DeliveryService,
    private readonly dlq: DlqService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, tenantId, variables, NotificationId } = job.data;

    if (
      await this.delivery.isAlreadyDelivered(NotificationId, ChannelType.EMAIL)
    ) {
      this.logger.log(
        `email skip (already delivered) notificationId=${NotificationId}`,
      );
      return;
    }

    await this.delivery.markProcessing(
      NotificationId,
      tenantId,
      ChannelType.EMAIL,
    );

    const { subject, body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.EMAIL,
      variables,
    );
    try {
      const result = await this.emailService.send({
        to: variables.email,
        subject: subject ?? '(no subject)',
        body: body ?? '',
      });
      await this.delivery.markDelivered(
        NotificationId,
        ChannelType.EMAIL,
        result.messageId,
      );
    } catch (err) {
      await this.delivery.markFailed(NotificationId, ChannelType.EMAIL, err);
      throwClassifiedEmail(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `email completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `email failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const permanent = err.name === 'UnrecoverableError';
    if (exhausted || permanent) {
      await this.delivery.markDlq(
        job.data.NotificationId,
        ChannelType.EMAIL,
        err,
      );
      await this.dlq.deadLetter(
        job.data,
        ChannelType.EMAIL,
        err,
        job.attemptsMade,
      );
    }
  }
}
