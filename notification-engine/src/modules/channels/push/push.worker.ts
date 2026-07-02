import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { PushService } from './push.service';
import { TemplateService } from '../../template/template.service';
import { DeliveryService } from '../../delivery/delivery.service';
import { DlqService } from '../../delivery/dlq.service';
import { ChannelType } from '@common/enums/channel-type.enum';
import { throwClassifiedPush } from './push.errors';

@Processor('push')
export class PushWorker extends WorkerHost {
  private readonly logger = new Logger(PushWorker.name);

  constructor(
    private readonly push: PushService,
    private readonly templateService: TemplateService,
    private readonly delivery: DeliveryService,
    private readonly dlq: DlqService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, tenantId, variables, NotificationId } = job.data;

    if (
      await this.delivery.isAlreadyDelivered(NotificationId, ChannelType.PUSH)
    ) {
      this.logger.log(
        `push skip (already delivered) notificationId=${NotificationId}`,
      );
      return;
    }

    await this.delivery.markProcessing(
      NotificationId,
      tenantId,
      ChannelType.PUSH,
    );

    const { subject, body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.PUSH,
      variables,
    );
    try {
      const result = await this.push.send({
        to: variables.token,
        subject: subject ?? '',
        body: body ?? '',
      });
      await this.delivery.markDelivered(
        NotificationId,
        ChannelType.PUSH,
        result.messageId,
      );
    } catch (err) {
      await this.delivery.markFailed(NotificationId, ChannelType.PUSH, err);
      throwClassifiedPush(err);
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<NotificationJobData>) {
    this.logger.log(
      `push completed notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `push failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    const permanent = err.name === 'UnrecoverableError';
    if (exhausted || permanent) {
      await this.delivery.markDlq(
        job.data.NotificationId,
        ChannelType.PUSH,
        err,
      );
      await this.dlq.deadLetter(
        job.data,
        ChannelType.PUSH,
        err,
        job.attemptsMade,
      );
    }
  }
}
