import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { ChannelType } from '@common/enums/channel-type.enum';

export class CreateTemplateDto {
  @IsString()
  tenantId!: string;

  @IsString()
  eventType!: string;

  @IsEnum(ChannelType)
  channel!: ChannelType;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  version?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
