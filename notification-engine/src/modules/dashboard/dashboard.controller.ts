import { Controller, Get, Param, Query, Sse } from '@nestjs/common';
import { interval, switchMap, startWith, map, Observable, from } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { ChannelStats } from '../delivery/delivery.service';

interface MessageEvent {
  data: string;
}

@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  /** GET /api/v1/dashboard/stats — per-channel delivery analytics. */
  @Get('dashboard/stats')
  stats(
    @Query('tenantId') tenantId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ChannelStats[]> {
    return this.dashboard.stats({
      tenantId,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /** GET /api/v1/notifications/:userId — paginated notification history. */
  @Get('notifications/:userId')
  history(
    @Param('userId') userId: string,
    @Query('tenantId') tenantId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.dashboard.userHistory(userId, {
      tenantId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /**
   * GET /api/v1/dashboard/stream — Server-Sent Events feed of the stats,
   * re-aggregated and pushed every 5 seconds (immediately on connect).
   */
  @Sse('dashboard/stream')
  stream(@Query('tenantId') tenantId?: string): Observable<MessageEvent> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => from(this.dashboard.stats({ tenantId }))),
      map((stats) => ({ data: JSON.stringify(stats) })),
    );
  }
}
