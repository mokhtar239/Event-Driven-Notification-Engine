import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MongooseModule } from '@nestjs/mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import { EmailWorker } from './email/email.worker';
import { SmsWorker } from './sms/sms.worker';
import { PushWorker } from './push/push.worker';
import { InappWorker } from './inapp/inapp.worker';
import { EmailService } from './email/emailService';
import { SmsService } from './sms/smsService';
import { PushService } from './push/pushService';
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
      { name: ChannelType.EMAIL },
      { name: ChannelType.SMS },
      { name: ChannelType.PUSH },
      { name: ChannelType.INAPP },
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
