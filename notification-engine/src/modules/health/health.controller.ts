import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly amqp: AmqpConnection) {}

  @Get()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        timestamp: '2026-07-07T12:00:00.000Z',
        uptime: 1234.5,
        rabbitmq: 'up',
      },
    },
  })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rabbitmq: this.amqp.connected ? 'up' : 'down',
    };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  live() {
    return { status: 'ok' };
  }
}
