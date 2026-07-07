import { IsOptional, IsString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class QuietHoursDto {
  @ApiPropertyOptional({
    example: '22:00',
    description: 'Quiet-hours start, HH:mm 24-hour.',
  })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'start must be in HH:mm 24-hour format' })
  start?: string;

  @ApiPropertyOptional({
    example: '07:30',
    description: 'Quiet-hours end, HH:mm 24-hour. May wrap past midnight.',
  })
  @IsOptional()
  @Matches(TIME_REGEX, { message: 'end must be in HH:mm 24-hour format' })
  end?: string;

  @ApiPropertyOptional({
    example: 'America/New_York',
    description: 'IANA timezone the quiet-hours window is evaluated in.',
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
