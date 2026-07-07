import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

const PREFERENCES_EXAMPLE = {
  tenantId: 'default',
  userId: '11111111-1111-4111-8111-111111111111',
  channels: { email: true, sms: false, push: true, inapp: true },
  quietHours: { start: '22:00', end: '07:30', timezone: 'America/New_York' },
  digestMode: 'daily',
  mutedEvents: ['marketing.*'],
};

@ApiTags('preferences')
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly svc: PreferencesService) {}

  @Get(':userId')
  @ApiOperation({
    summary: 'Get a user’s preferences (created with defaults on first access)',
  })
  @ApiParam({ name: 'userId', example: '11111111-1111-4111-8111-111111111111' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'default' })
  @ApiOkResponse({ schema: { example: PREFERENCES_EXAMPLE } })
  get(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId = 'default',
  ) {
    return this.svc.getOrCreate(tenantId, userId);
  }

  @Put(':userId')
  @ApiOperation({ summary: 'Update a user’s preferences (partial)' })
  @ApiParam({ name: 'userId', example: '11111111-1111-4111-8111-111111111111' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'default' })
  @ApiOkResponse({ schema: { example: PREFERENCES_EXAMPLE } })
  update(
    @Param('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
    @Query('tenantId') tenantId = 'default',
  ) {
    return this.svc.update(tenantId, userId, dto);
  }
}
