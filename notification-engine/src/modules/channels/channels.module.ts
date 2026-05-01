import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ChannelType } from '@common/enums/channel-type.enum';
import { EmailWorker } from './email/email.worker';
import { SmsWorker } from './sms/sms.worker';
import { PushWorker } from './push/push.worker';
import { InappWorker } from './inapp/inapp.worker';
import { EmailService } from './email/emailService';
import { SmsService } from './sms/smsService';
import { PushService } from './push/pushService';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: ChannelType.EMAIL },
      { name: ChannelType.SMS },
      { name: ChannelType.PUSH },
      { name: ChannelType.INAPP },
    ),
  ],
  providers: [
    EmailWorker,
    SmsWorker,
    PushWorker,
    InappWorker,
    EmailService,
    SmsService,
    PushService,
  ],
  exports: [BullModule],
})
export class ChannelsModule {}
