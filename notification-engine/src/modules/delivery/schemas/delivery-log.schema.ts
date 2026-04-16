import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import { DeliveryStatus } from '@common/enums/delivery-status.enum';

export type DeliveryLogDocument = HydratedDocument<DeliveryLog>;

@Schema({ timestamps: true, collection: 'delivery_logs' })
export class DeliveryLog {
  @Prop({
    type: Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true,
  })
  notificationId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, enum: ChannelType, required: true })
  channel!: ChannelType;

  @Prop({
    type: String,
    enum: DeliveryStatus,
    default: DeliveryStatus.QUEUED,
    index: true,
  })
  status!: DeliveryStatus;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop()
  lastError?: string;

  @Prop()
  externalMessageId?: string;

  @Prop()
  deliveredAt?: Date;
}

export const DeliveryLogSchema = SchemaFactory.createForClass(DeliveryLog);

DeliveryLogSchema.index({ notificationId: 1, channel: 1 });
DeliveryLogSchema.index({ tenantId: 1, status: 1, createdAt: -1 });