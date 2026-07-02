import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bullmq';
import { ChannelType } from '@common/enums/channel-type.enum';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import { DeliveryLog, DeliveryLogSchema } from './schemas/delivery-log.schema';
import { DeadLetter, DeadLetterSchema } from './schemas/dead-letter.schema';
import { DeliveryService } from './delivery.service';
import { DlqService } from './dlq.service';
import { DlqController } from './dlq.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeliveryLog.name, schema: DeliveryLogSchema },
      { name: DeadLetter.name, schema: DeadLetterSchema },
    ]),
    BullModule.registerQueue(
      { name: ChannelType.EMAIL },
      { name: ChannelType.SMS },
      { name: ChannelType.PUSH },
      { name: ChannelType.INAPP },
    ),
  ],
  controllers: [DlqController],
  providers: [DeliveryService, DlqService],
  exports: [DeliveryService, DlqService, MongooseModule],
})
export class DeliveryModule {}
