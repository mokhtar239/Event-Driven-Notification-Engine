import { ConfigService } from '@nestjs/config';
import { RabbitMQConfig } from '@golevelup/nestjs-rabbitmq';

export const EVENT_EXCHANGE = 'notification.events';
export const EVENT_DLX = 'notification.events.dlx';
export const EVENT_DLQ = 'notification.events.dlq';
export const EVENT_MAIN_QUEUE = 'notification.events.main';

export const rabbitMQConfig = (config: ConfigService): RabbitMQConfig => ({
  uri: config.getOrThrow<string>('RABBITMQ_URL'),
  exchanges: [
    {
      name: EVENT_EXCHANGE,
      type: 'topic',
      options: {
        durable: true,
      },
    },
    {
      name: EVENT_DLX,
      type: 'topic',
      options: {
        durable: true,
      },
    },
  ],
  channels: {
    default: {
      default: true,
      prefetchCount: 10,
    },
  },
  connectionInitOptions: { wait: true, timeout: 2000 },
  enableControllerDiscovery: true,
});
