import { DeliveryResult } from './delivery-result.interface';

export interface ChannelPayload {
  to: string;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

export interface IChannel {
  send(payload: ChannelPayload): Promise<DeliveryResult>;
}
