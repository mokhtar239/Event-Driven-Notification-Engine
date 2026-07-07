import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { DashboardService } from './dashboard.service';
import { DeliveryService } from '../delivery/delivery.service';
import {
  Notification,
  NotificationSchema,
  NotificationDocument,
} from '../delivery/schemas/notification.schema';
import { NotificationStatus } from '@common/enums/delivery-status.enum';

describe('DashboardService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: DashboardService;
  let notifModel: Model<NotificationDocument>;
  const delivery = { getStats: jest.fn() };

  const seed = (userId: string, tenantId: string, n: number) =>
    Promise.all(
      Array.from({ length: n }, (_, i) =>
        notifModel.create({
          eventType: `evt.${i}`,
          userId,
          tenantId,
          data: {},
          channels: [],
          status: NotificationStatus.PENDING,
          priority: 3,
        }),
      ),
    );

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Notification.name, schema: NotificationSchema },
        ]),
      ],
      providers: [
        DashboardService,
        { provide: DeliveryService, useValue: delivery },
      ],
    }).compile();

    service = moduleRef.get(DashboardService);
    notifModel = moduleRef.get(getModelToken(Notification.name));
  });

  afterEach(async () => {
    await notifModel.deleteMany({});
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await mongod.stop();
  });

  it('stats() delegates to DeliveryService.getStats', async () => {
    delivery.getStats.mockResolvedValue([{ channel: 'email' }]);
    const res = await service.stats({ tenantId: 't1' });
    expect(delivery.getStats).toHaveBeenCalledWith({ tenantId: 't1' });
    expect(res).toEqual([{ channel: 'email' }]);
  });

  it('paginates history and reports the correct total', async () => {
    await seed('u1', 't1', 25);
    const page1 = await service.userHistory('u1', { limit: 10, page: 1 });
    expect(page1.total).toBe(25);
    expect(page1.items).toHaveLength(10);

    const page3 = await service.userHistory('u1', { limit: 10, page: 3 });
    expect(page3.items).toHaveLength(5);
  });

  it('clamps page to >= 1 and limit to [1, 100]', async () => {
    await seed('u1', 't1', 3);
    const clamped = await service.userHistory('u1', { page: 0, limit: 9999 });
    expect(clamped.page).toBe(1);
    expect(clamped.limit).toBe(100);
    expect(clamped.items).toHaveLength(3);
  });

  it('scopes by tenantId', async () => {
    await seed('u1', 't1', 2);
    await seed('u1', 't2', 4);
    const t2 = await service.userHistory('u1', { tenantId: 't2' });
    expect(t2.total).toBe(4);
  });
});
