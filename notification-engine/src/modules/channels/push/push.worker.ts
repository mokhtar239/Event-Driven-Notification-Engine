import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { PushService } from './push.service';
import { TemplateService } from '../../template/template.service';
import { ChannelType } from '@common/enums/channel-type.enum';
import { throwClassifiedPush } from './push.errors';

@Processor('push')
export class PushWorker extends WorkerHost {
  private readonly logger = new Logger(PushWorker.name);

  constructor(
    private readonly push: PushService,
    private readonly templateService: TemplateService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, tenantId, variables } = job.data;
    const { subject, body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.PUSH,
      variables,
    );
    try {
      await this.push.send({
        to: variables.token,
        subject: subject ?? '',
        body: body ?? '',
      });
    } catch (err) {
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
  onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `push failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
  }
}
