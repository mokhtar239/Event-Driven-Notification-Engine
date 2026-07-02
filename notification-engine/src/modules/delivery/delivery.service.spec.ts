import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model, Types } from 'mongoose';
import { DeliveryService } from './delivery.service';
import {
  DeliveryLog,
  DeliveryLogSchema,
  DeliveryLogDocument,
} from './schemas/delivery-log.schema';
import {
  Notification,
  NotificationSchema,
  NotificationDocument,
} from './schemas/notification.schema';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { NotificationStatus } from '../../common/enums/delivery-status.enum';

/**
 * Integration tests for DeliveryService — the per-attempt tracking, the parent
 * status rollup FSM, and the getStats aggregation. Runs against in-memory Mongo
 * so the aggregation pipeline is exercised for real.
 */
describe('DeliveryService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: DeliveryService;
  let notifModel: Model<NotificationDocument>;
  let logModel: Model<DeliveryLogDocument>;

  const newNotification = async (channels: ChannelType[]) => {
    const n = await notifModel.create({
      eventType: 'order.placed',
      userId: 'u1',
      tenantId: 't1',
      data: {},
      channels,
      status: NotificationStatus.PENDING,
      priority: 3,
    });
    return n._id.toString();
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Notification.name, schema: NotificationSchema },
          { name: DeliveryLog.name, schema: DeliveryLogSchema },
        ]),
      ],
      providers: [DeliveryService],
    }).compile();

    service = moduleRef.get(DeliveryService);
    notifModel = moduleRef.get(getModelToken(Notification.name));
    logModel = moduleRef.get(getModelToken(DeliveryLog.name));
  });

  afterEach(async () => {
    await Promise.all([notifModel.deleteMany({}), logModel.deleteMany({})]);
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('attempt tracking', () => {
    it('markProcessing upserts a row and bumps attempts', async () => {
      const id = await newNotification([ChannelType.EMAIL]);

      await service.markProcessing(id, 't1', ChannelType.EMAIL);
      await service.markProcessing(id, 't1', ChannelType.EMAIL);

      const log = await logModel.findOne({
        notificationId: new Types.ObjectId(id),
        channel: ChannelType.EMAIL,
      });
      expect(log?.attempts).toBe(2);
    });

    it('isAlreadyDelivered reflects a delivered row', async () => {
      const id = await newNotification([ChannelType.EMAIL]);
      await service.markProcessing(id, 't1', ChannelType.EMAIL);

      expect(await service.isAlreadyDelivered(id, ChannelType.EMAIL)).toBe(
        false,
      );
      await service.markDelivered(id, ChannelType.EMAIL, 'msg-1');
      expect(await service.isAlreadyDelivered(id, ChannelType.EMAIL)).toBe(
        true,
      );
    });
  });

  describe('rollup FSM', () => {
    it('all channels delivered → SENT', async () => {
      const id = await newNotification([ChannelType.EMAIL, ChannelType.INAPP]);
      await service.markProcessing(id, 't1', ChannelType.EMAIL);
      await service.markProcessing(id, 't1', ChannelType.INAPP);
      await service.markDelivered(id, ChannelType.EMAIL, 'm1');
      await service.markDelivered(id, ChannelType.INAPP, 'm2');

      const n = await notifModel.findById(id);
      expect(n?.status).toBe(NotificationStatus.SENT);
    });

    it('some delivered, some dlq → PARTIAL', async () => {
      const id = await newNotification([ChannelType.EMAIL, ChannelType.SMS]);
      await service.markProcessing(id, 't1', ChannelType.EMAIL);
      await service.markProcessing(id, 't1', ChannelType.SMS);
      await service.markDelivered(id, ChannelType.EMAIL, 'm1');
      await service.markDlq(id, ChannelType.SMS, new Error('failed'));

      const n = await notifModel.findById(id);
      expect(n?.status).toBe(NotificationStatus.PARTIAL);
    });

    it('none delivered → FAILED', async () => {
      const id = await newNotification([ChannelType.SMS]);
      await service.markProcessing(id, 't1', ChannelType.SMS);
      await service.markDlq(id, ChannelType.SMS, new Error('failed'));

      const n = await notifModel.findById(id);
      expect(n?.status).toBe(NotificationStatus.FAILED);
    });
  });

  describe('getStats', () => {
    it('computes per-channel counts and rates', async () => {
      const id = await newNotification([ChannelType.EMAIL, ChannelType.SMS]);
      await service.markProcessing(id, 't1', ChannelType.EMAIL);
      await service.markProcessing(id, 't1', ChannelType.SMS);
      await service.markDelivered(id, ChannelType.EMAIL, 'm1');
      await service.markDlq(id, ChannelType.SMS, new Error('x'));

      const stats = await service.getStats({ tenantId: 't1' });
      const emailStat = stats.find((s) => s.channel === ChannelType.EMAIL);
      const smsStat = stats.find((s) => s.channel === ChannelType.SMS);

      expect(emailStat?.delivered).toBe(1);
      expect(emailStat?.deliveryRate).toBe(1);
      expect(smsStat?.dlq).toBe(1);
      expect(smsStat?.failureRate).toBe(1);
    });

    it('scopes by tenantId', async () => {
      const id = await newNotification([ChannelType.EMAIL]);
      await service.markProcessing(id, 't1', ChannelType.EMAIL);
      await service.markDelivered(id, ChannelType.EMAIL, 'm1');

      const other = await service.getStats({ tenantId: 'other-tenant' });
      expect(other).toHaveLength(0);
    });
  });
});
