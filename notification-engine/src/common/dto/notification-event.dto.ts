import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class NotificationEventDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsOptional()
  @IsString()
  tenantId?: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  correlationId?: string;
}
