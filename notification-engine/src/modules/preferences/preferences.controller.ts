import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { PreferencesService } from './preferences.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

/**
 * Preference management API (Step 9).
 *
 * tenantId is taken from a query param for now and defaults to 'default'.
 * Once the tenant middleware lands (Step 19) this should be sourced from the
 * tenant context (AsyncLocalStorage) instead.
 */
@Controller('preferences')
export class PreferencesController {
  constructor(private readonly svc: PreferencesService) {}

  @Get(':userId')
  get(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId = 'default',
  ) {
    return this.svc.getOrCreate(tenantId, userId);
  }

  @Put(':userId')
  update(
    @Param('userId') userId: string,
    @Body() dto: UpdatePreferencesDto,
    @Query('tenantId') tenantId = 'default',
  ) {
    return this.svc.update(tenantId, userId, dto);
  }
}
