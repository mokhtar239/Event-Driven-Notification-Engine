import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateChannelsDto {
  @ApiPropertyOptional({ example: true, description: 'Opt in/out of email.' })
  @IsOptional()
  @IsBoolean()
  email?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Opt in/out of SMS.' })
  @IsOptional()
  @IsBoolean()
  sms?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Opt in/out of push.' })
  @IsOptional()
  @IsBoolean()
  push?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Opt in/out of in-app notifications.',
  })
  @IsOptional()
  @IsBoolean()
  inapp?: boolean;
}
