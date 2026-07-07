import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useWebSocketAdapter(new IoAdapter(app));
  app.enableCors();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Notification Engine API')
    .setDescription(
      'Event-driven, multi-tenant, multi-channel notification microservice.',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'api-key')
    .addTag('events', 'Publish and inspect domain events')
    .addTag('templates', 'Notification template CRUD & preview')
    .addTag('preferences', 'Per-user channel/quiet-hour preferences')
    .addTag('dlq', 'Dead-letter queue administration')
    .addTag('dashboard', 'Delivery analytics & real-time stats')
    .addTag('health', 'Liveness & readiness probes')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
