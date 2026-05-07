import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { SmsService } from './smsService';
import { TemplateService } from '../../template/template.service';
import { ChannelType } from '@common/enums/channel-type.enum';

@Processor('sms')
export class SmsWorker extends WorkerHost {
  private readonly logger = new Logger(SmsWorker.name);

  constructor(
    private readonly smsService: SmsService,
    private readonly templateService: TemplateService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, tenantId, variables } = job.data;
    this.logger.log(
      `Processing sms job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    const { body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.SMS,
      variables,
    );
    await this.smsService.send({
      to: variables.phone,
      body: body ?? '',
    });
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
