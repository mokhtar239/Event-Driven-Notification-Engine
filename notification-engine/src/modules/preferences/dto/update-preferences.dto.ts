import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DigestMode } from '../schemas/user-preference.schema';
import { UpdateChannelsDto } from './update-channels.dto';
import { QuietHoursDto } from './quiet-hours.dto';

export class UpdatePreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateChannelsDto)
  channels?: UpdateChannelsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  quietHours?: QuietHoursDto;

  @IsOptional()
  @IsEnum(DigestMode)
  digestMode?: DigestMode;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mutedEvents?: string[];
}
