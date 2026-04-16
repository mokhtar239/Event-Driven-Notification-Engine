import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';
import { NotificationStatus } from '@common/enums/delivery-status.enum';
import { EventPriority } from '@common/enums/event-priority.enum';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true, index: true })
  eventType!: string;

  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: Object, default: {} })
  data!: Record<string, any>;

  @Prop({ type: [String], enum: ChannelType, required: true })
  channels!: ChannelType[];

  @Prop({
    type: String,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
    index: true,
  })
  status!: NotificationStatus;

  @Prop({
    type: Number,
    enum: EventPriority,
    default: EventPriority.NORMAL,
  })
  priority!: EventPriority;

  @Prop()
  correlationId?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ eventType: 1, tenantId: 1 });