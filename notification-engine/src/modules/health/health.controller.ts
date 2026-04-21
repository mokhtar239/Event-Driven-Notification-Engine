import { Controller, Get } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';

@Controller('health')
export class HealthController {
  constructor(private readonly amqp: AmqpConnection) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      rabbitmq: this.amqp.connected ? 'up' : 'down',
    };
  }
}
