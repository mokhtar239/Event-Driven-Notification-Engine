import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { ChannelType } from '@common/enums/channel-type.enum';

export type TemplateDocument = HydratedDocument<Template>;

@Schema({ timestamps: true, collection: 'templates' })
export class Template {
  @Prop({ required: true, index: true })
  eventType!: string;

  @Prop({ type: String, enum: ChannelType, required: true })
  channel!: ChannelType;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop()
  subject?: string;

  @Prop({ required: true })
  body!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: 1 })
  version!: number;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);

TemplateSchema.index(
  { eventType: 1, channel: 1, tenantId: 1, version: 1 },
  { unique: true },
);
