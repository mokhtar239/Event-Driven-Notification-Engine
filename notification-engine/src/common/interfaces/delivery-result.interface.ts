export interface DeliveryResult {
  success: boolean;
  messageId?: string;
  error?: string;
  timestamp: Date;
}
