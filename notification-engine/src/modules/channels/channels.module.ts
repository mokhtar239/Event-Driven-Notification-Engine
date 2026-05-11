import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import { EmailWorker } from './email/email.worker';
import { SmsWorker } from './sms/sms.worker';
import { PushWorker } from './push/push.worker';
import { InappWorker } from './inapp/inapp.worker';
import { EmailService } from './email/emailService';
import { SmsService } from './sms/sms.service';
import { PushService } from './push/push.service';
import { InappService } from './inapp/inapp.service';
import { InappGateway } from './inapp/inapp.gateway';
import {
  InappNotification,
  InappNotificationSchema,
} from './inapp/schemas/inapp-notification.schema';
import { TemplateModule } from '../template/template.module';

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: ChannelType.EMAIL,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      },
      {
        name: ChannelType.SMS,
        defaultJobOptions: {
          attempts: 5,
          backoff: { type: 'fixed', delay: 60_000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      },
      {
        name: ChannelType.PUSH,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      },
      {
        name: ChannelType.INAPP,
        defaultJobOptions: {
          attempts: 1,
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
        },
      },
    ),
    MongooseModule.forFeature([
      { name: InappNotification.name, schema: InappNotificationSchema },
    ]),
    TemplateModule,
  ],
  providers: [
    EmailWorker,
    SmsWorker,
    PushWorker,
    InappWorker,
    EmailService,
    SmsService,
    PushService,
    InappService,
    InappGateway,
  ],
  exports: [BullModule],
})
export class ChannelsModule {}
