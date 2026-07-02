import { IsOptional, IsString, Matches } from 'class-validator';

// HH:mm 24-hour format, e.g. "22:00" or "07:30"
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class QuietHoursDto {
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'start must be in HH:mm 24-hour format' })
  start?: string;

  @IsOptional()
  @Matches(TIME_REGEX, { message: 'end must be in HH:mm 24-hour format' })
  end?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
