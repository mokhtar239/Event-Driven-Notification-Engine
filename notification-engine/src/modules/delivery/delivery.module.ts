import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';
import {
  DeliveryLog,
  DeliveryLogSchema,
} from './schemas/delivery-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: DeliveryLog.name, schema: DeliveryLogSchema },
    ]),
  ],
  exports: [MongooseModule],
})
export class DeliveryModule {}