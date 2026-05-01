import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type InappNotificationDocument = HydratedDocument<InappNotification>;

@Schema({ timestamps: true, collection: 'inapp_notifications' })
export class InappNotification {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ default: false })
  read!: boolean;
}

export const InappNotificationSchema =
  SchemaFactory.createForClass(InappNotification);
