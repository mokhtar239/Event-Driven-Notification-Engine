import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DigestMode } from '../schemas/user-preference.schema';
import { UpdateChannelsDto } from './update-channels.dto';
import { QuietHoursDto } from './quiet-hours.dto';

export class UpdatePreferencesDto {
  @ApiPropertyOptional({ type: () => UpdateChannelsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateChannelsDto)
  channels?: UpdateChannelsDto;

  @ApiPropertyOptional({ type: () => QuietHoursDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @ApiPropertyOptional({
    enum: DigestMode,
    example: DigestMode.DAILY,
    description:
      'instant = send now; hourly/daily = batch email into a digest.',
  })
  @IsOptional()
  @IsEnum(DigestMode)
  digestMode?: DigestMode;

  @ApiPropertyOptional({
    type: [String],
    example: ['marketing.*', 'friend.request'],
    description: 'Event types to mute; supports "<domain>.*" wildcards.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutedEvents?: string[];
}
