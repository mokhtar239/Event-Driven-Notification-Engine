import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import { NotificationJobData } from '@common/interfaces/notification-job.interface';

export type DeadLetterDocument = HydratedDocument<DeadLetter>;

@Schema({ timestamps: true, collection: 'dead_letters' })
export class DeadLetter {
  @Prop({
    type: Types.ObjectId,
    ref: 'Notification',
    required: true,
    index: true,
  })
  notificationId!: Types.ObjectId;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, enum: ChannelType, required: true, index: true })
  channel!: ChannelType;

  @Prop({ type: Object, required: true })
  payload!: NotificationJobData;

  @Prop({ required: true })
  error!: string;

  @Prop({ default: 0 })
  attempts!: number;

  @Prop({ default: false, index: true })
  replayed!: boolean;
}

export const DeadLetterSchema = SchemaFactory.createForClass(DeadLetter);
DeadLetterSchema.index({ tenantId: 1, channel: 1, createdAt: -1 });
