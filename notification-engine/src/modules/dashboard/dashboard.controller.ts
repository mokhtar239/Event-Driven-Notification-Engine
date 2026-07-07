import { Controller, Get, Param, Query, Sse } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { interval, switchMap, startWith, map, Observable, from } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { ChannelStats } from '../delivery/delivery.service';

interface MessageEvent {
  data: string;
}

const CHANNEL_STATS_EXAMPLE = [
  {
    channel: 'email',
    total: 120,
    delivered: 116,
    failed: 3,
    dlq: 1,
    deliveryRate: 0.9667,
    failureRate: 0.0333,
    avgDeliveryMs: 842,
  },
];

@ApiTags('dashboard')
@Controller()
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('dashboard/stats')
  @ApiOperation({ summary: 'Per-channel delivery analytics' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'acme' })
  @ApiQuery({
    name: 'from',
    required: false,
    example: '2026-07-01T00:00:00.000Z',
    description: 'ISO-8601 lower bound on createdAt.',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    example: '2026-07-07T23:59:59.000Z',
    description: 'ISO-8601 upper bound on createdAt.',
  })
  @ApiOkResponse({ schema: { example: CHANNEL_STATS_EXAMPLE } })
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

  @Get('notifications/:userId')
  @ApiOperation({ summary: 'Paginated notification history for a user' })
  @ApiParam({ name: 'userId', example: '11111111-1111-4111-8111-111111111111' })
  @ApiQuery({ name: 'tenantId', required: false, example: 'acme' })
  @ApiQuery({ name: 'page', required: false, example: '1' })
  @ApiQuery({ name: 'limit', required: false, example: '20' })
  @ApiOkResponse({
    schema: {
      example: {
        userId: '11111111-1111-4111-8111-111111111111',
        page: 1,
        limit: 20,
        total: 3,
        items: [
          {
            _id: '665f1b2c9a1e4c0012ab34cd',
            eventType: 'order.placed',
            status: 'sent',
            channels: ['email', 'inapp'],
            createdAt: '2026-07-07T12:00:00.000Z',
          },
        ],
      },
    },
  })
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

  @Sse('dashboard/stream')
  @ApiOperation({
    summary: 'Server-Sent Events feed of the stats (pushed every 5s)',
  })
  @ApiProduces('text/event-stream')
  @ApiQuery({ name: 'tenantId', required: false, example: 'acme' })
  stream(@Query('tenantId') tenantId?: string): Observable<MessageEvent> {
    return interval(5000).pipe(
      startWith(0),
      switchMap(() => from(this.dashboard.stats({ tenantId }))),
      map((stats) => ({ data: JSON.stringify(stats) })),
    );
  }
}
