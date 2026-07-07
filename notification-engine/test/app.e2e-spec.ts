import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import request from 'supertest';
import { App } from 'supertest/types';
import { EventIngestionController } from '../src/modules/event-ingestion/event-ingestion.controller';
import { EventIngestionService } from '../src/modules/event-ingestion/event-ingestion.service';
import { HealthController } from '../src/modules/health/health.controller';

describe('HTTP API (e2e)', () => {
  let app: INestApplication<App>;
  const ingest = { ingestEvent: jest.fn() };

  const validEvent = {
    eventType: 'order.placed',
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    data: { orderId: 'A-1' },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [EventIngestionController, HealthController],
      providers: [
        { provide: EventIngestionService, useValue: ingest },
        { provide: AmqpConnection, useValue: { connected: true } },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
  });

  beforeEach(() => jest.clearAllMocks());

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/health', () => {
    it('returns ok and dependency status', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.rabbitmq).toBe('up');
    });

    it('liveness probe returns ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/live')
        .expect(200)
        .expect({ status: 'ok' });
    });
  });

  describe('POST /api/v1/events/publish', () => {
    it('accepts a valid event (202) and echoes ids', async () => {
      ingest.ingestEvent.mockResolvedValue({
        success: true,
        notificationId: 'notif-1',
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/events/publish')
        .send(validEvent)
        .expect(202);

      expect(res.body.notificationId).toBe('notif-1');
      expect(res.body.correlationId).toBeDefined();
      expect(ingest.ingestEvent).toHaveBeenCalledTimes(1);
    });

    it('rejects a malformed eventType (400) before hitting the service', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/events/publish')
        .send({ ...validEvent, eventType: 'NOT VALID' })
        .expect(400);
      expect(ingest.ingestEvent).not.toHaveBeenCalled();
    });

    it('rejects a non-UUID userId (400)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/events/publish')
        .send({ ...validEvent, userId: 'nope' })
        .expect(400);
      expect(ingest.ingestEvent).not.toHaveBeenCalled();
    });
  });
});
