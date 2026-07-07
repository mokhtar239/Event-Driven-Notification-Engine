import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsUUID,
  IsISO8601,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationEventDto {
  @ApiProperty({
    example: 'order.placed',
    description: 'Event type in "<domain>.<action>" form.',
  })
  @Matches(/^[a-z]+\.[a-z_]+$/, {
    message: 'eventType must match "<domain>.<action>" e.g. order.placed',
  })
  eventType!: string;

  @ApiProperty({ format: 'uuid', description: 'Recipient user id.' })
  @IsUUID()
  userId!: string;

  @ApiProperty({ format: 'uuid', description: 'Owning tenant id.' })
  @IsUUID()
  tenantId!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'Event payload; becomes the template render variables.',
    example: { orderId: 'A-1001', total: 42.5 },
  })
  @IsObject()
  data!: Record<string, unknown>;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'When the event occurred (ISO-8601). Defaults to now.',
  })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @ApiPropertyOptional({
    description: 'Trace id; generated if omitted.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  correlationId?: string;
}
