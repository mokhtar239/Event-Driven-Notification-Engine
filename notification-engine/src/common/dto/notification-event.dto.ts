import { IsString, IsNotEmpty, IsOptional, IsObject, IsUUID, IsISO8601, Matches } from 'class-validator';

export class NotificationEventDto {
  @Matches(/^[a-z]+\.[a-z_]+$/, { message: 'eventType must match "<domain>.<action>" e.g. order.placed' })
  eventType!: string;

  @IsUUID()
  userId!: string;

  @IsUUID()
  tenantId!: string;

  @IsObject()
  data!: Record<string, unknown>;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  correlationId?: string;
}
