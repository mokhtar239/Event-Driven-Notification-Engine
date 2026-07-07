import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DigestMode } from '../../preferences/schemas/user-preference.schema';

export type DigestBatchDocument = HydratedDocument<DigestBatch>;

export enum DigestItemStatus {
  PENDING = 'pending',
  SENT = 'sent',
}

@Schema({ timestamps: true, collection: 'digest_batches' })
export class DigestBatch {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: String, enum: DigestMode, required: true, index: true })
  mode!: DigestMode;

  @Prop({ required: true })
  eventType!: string;

  @Prop({ type: Types.ObjectId, ref: 'Notification' })
  notificationId?: Types.ObjectId;

  @Prop({ required: true })
  to!: string;

  @Prop({ required: true })
  summary!: string;

  @Prop({
    type: String,
    enum: DigestItemStatus,
    default: DigestItemStatus.PENDING,
    index: true,
  })
  status!: DigestItemStatus;

  @Prop()
  sentAt?: Date;
}

export const DigestBatchSchema = SchemaFactory.createForClass(DigestBatch);

DigestBatchSchema.index({ mode: 1, status: 1, tenantId: 1, userId: 1 });
