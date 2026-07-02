import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { DigestMode } from '../../preferences/schemas/user-preference.schema';

export type DigestBatchDocument = HydratedDocument<DigestBatch>;

/**
 * One buffered notification awaiting inclusion in a user's next digest.
 * The cron collects all PENDING rows for a (mode) bucket, renders one email
 * per user, sends it, then marks them SENT.
 */
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

  // Destination email captured at buffer time (no user-profile store exists).
  @Prop({ required: true })
  to!: string;

  // Rendered single-line summary for this item, e.g. "Order #ORD-1001 confirmed".
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

// Fast lookup of a user's pending items for a given mode during flush.
DigestBatchSchema.index({ mode: 1, status: 1, tenantId: 1, userId: 1 });
