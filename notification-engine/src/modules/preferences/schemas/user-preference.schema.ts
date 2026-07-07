import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserPreferenceDocument = HydratedDocument<UserPreference>;

export enum DigestMode {
  INSTANT = 'instant',
  HOURLY = 'hourly',
  DAILY = 'daily',
}

@Schema({ _id: false })
export class ChannelPreferences {
  @Prop({ default: true })
  email!: boolean;

  @Prop({ default: true })
  sms!: boolean;

  @Prop({ default: true })
  push!: boolean;

  @Prop({ default: true })
  inapp!: boolean;
}

@Schema({ _id: false })
export class QuietHours {
  @Prop()
  start?: string;

  @Prop()
  end?: string;

  @Prop({ default: 'UTC' })
  timezone!: string;
}

@Schema({ timestamps: true, collection: 'user_preferences' })
export class UserPreference {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  tenantId!: string;

  @Prop({ type: ChannelPreferences, default: () => ({}) })
  channels!: ChannelPreferences;

  @Prop({ type: QuietHours, default: () => ({}) })
  quietHours!: QuietHours;

  @Prop({
    type: String,
    enum: DigestMode,
    default: DigestMode.INSTANT,
  })
  digestMode!: DigestMode;

  @Prop({ type: [String], default: [] })
  mutedEvents!: string[];
}

export const UserPreferenceSchema =
  SchemaFactory.createForClass(UserPreference);

UserPreferenceSchema.index({ userId: 1, tenantId: 1 }, { unique: true });
