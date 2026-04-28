import { ChannelType } from '../enums/channel-type.enum';
export interface NotificationJobData {
  NotificationId: string;
  userId: string;
  tenantId: string;
  channel: ChannelType;
  event: string;
  templateId: string;
  priority: number;
  variables: Record<string, string>;
  metadata: Record<string, string>;
}
