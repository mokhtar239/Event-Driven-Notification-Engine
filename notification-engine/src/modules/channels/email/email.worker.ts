import { EmailService } from './emailService';
import { Logger } from '@nestjs/common';
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NotificationJobData } from '../../../common/interfaces/notification-job.interface';
import { TemplateService } from '../../template/template.service';
import { ChannelType } from '@common/enums/channel-type.enum';
import { throwClassifiedEmail } from './email.errors';

@Processor('email')
export class EmailWorker extends WorkerHost {
  private readonly logger = new Logger(EmailWorker.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
  ) {
    super();
  }

  async process(job: Job<NotificationJobData>): Promise<void> {
    const { event, tenantId, variables } = job.data;
    this.logger.log(
      `Processing email job notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}`,
    );
    const { subject, body } = await this.templateService.renderTemplate(
      tenantId,
      event,
      ChannelType.EMAIL,
      variables,
    );
    try {
      await this.emailService.send({
        to: variables.email,
        subject: subject ?? '(no subject)',
        body: body ?? '',
      });
    } catch (err) {
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
  onFailed(job: Job<NotificationJobData>, err: Error) {
    this.logger.error(
      `email failed (attempt ${job.attemptsMade}) notificationId=${job.data.NotificationId} correlationId=${job.data.metadata?.correlationId}: ${err.message}`,
    );
  }
}
