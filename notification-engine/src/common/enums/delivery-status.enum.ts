export enum DeliveryStatus {
  QUEUED = 'queued',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  DLQ = 'dlq',
}

export enum NotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  SENT = 'sent',
  PARTIAL = 'partial',
  FAILED = 'failed',
  SUPPRESSED = 'suppressed',
}
