import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChannelType } from '@common/enums/channel-type.enum';

export class CreateTemplateDto {
  @ApiProperty({
    example: '22222222-2222-4222-8222-222222222222',
    description: 'Owning tenant id.',
  })
  @IsString()
  tenantId!: string;

  @ApiProperty({
    example: 'order.placed',
    description: 'Event type this template renders, "<domain>.<action>".',
  })
  @IsString()
  eventType!: string;

  @ApiProperty({
    enum: ChannelType,
    example: ChannelType.EMAIL,
    description: 'Delivery channel this template targets.',
  })
  @IsEnum(ChannelType)
  channel!: ChannelType;

  @ApiPropertyOptional({
    example: 'Order #{{orderId}} confirmed',
    description:
      'Subject line (email only). Supports {{variables}} and helpers.',
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    example:
      'Hi {{firstName}}, your order #{{orderId}} for {{currency total}} is confirmed.',
    description:
      'Body template. Supports {{var}}, nested {{a.b}}, and helpers ({{currency total}}, {{uppercase code}}).',
  })
  @IsString()
  body!: string;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
    default: 1,
    description: 'Template version; highest version wins at render time.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description: 'Whether this template is active.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
