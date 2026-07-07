import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { EventIngestionService } from './event-ingestion.service';
import { EventRouter } from './event-ingestion.router';
import { DublicateGuardService } from './DublicateGuardService';
import { PreferenceRouter } from '../preferences/preference-router.service';
import { DigestService } from '../digest/digest.service';
import { DigestMode } from '../preferences/schemas/user-preference.schema';
import {
  Notification,
  NotificationSchema,
  NotificationDocument,
} from '../delivery/schemas/notification.schema';
import { NotificationStatus } from '@common/enums/delivery-status.enum';
import { ChannelType } from '@common/enums/channel-type.enum';
import { EventPriority } from '@common/enums/event-priority.enum';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';

describe('EventIngestionService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: EventIngestionService;
  let notifModel: Model<NotificationDocument>;

  const router = {
    resolve: jest.fn(),
    dispatch: jest.fn(),
  };
  const guard = { isFresh: jest.fn() };
  const prefRouter = { route: jest.fn() };
  const digest = { buffer: jest.fn() };

  const event = (
    over: Partial<NotificationEventDto> = {},
  ): NotificationEventDto => ({
    eventType: 'order.placed',
    userId: '11111111-1111-4111-8111-111111111111',
    tenantId: '22222222-2222-4222-8222-222222222222',
    data: { email: 'a@b.com', orderId: 'A-1' },
    ...over,
  });

  const okDecision = (over = {}) => ({
    channels: [ChannelType.EMAIL, ChannelType.SMS],
    suppressed: false,
    decisions: [],
    digestMode: DigestMode.INSTANT,
    ...over,
  });

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
        EventIngestionService,
        { provide: EventRouter, useValue: router },
        { provide: DublicateGuardService, useValue: guard },
        { provide: PreferenceRouter, useValue: prefRouter },
        { provide: DigestService, useValue: digest },
      ],
    }).compile();

    service = moduleRef.get(EventIngestionService);
    notifModel = moduleRef.get(getModelToken(Notification.name));
  });

  beforeEach(() => {
    jest.clearAllMocks();
    router.resolve.mockReturnValue({
      channels: [ChannelType.EMAIL, ChannelType.SMS],
      priority: EventPriority.NORMAL,
    });
    guard.isFresh.mockResolvedValue(true);
    prefRouter.route.mockResolvedValue(okDecision());
  });

  afterEach(async () => {
    await notifModel.deleteMany({});
  });

  afterAll(async () => {
    await mongod.stop();
  });

  it('rejects an unknown event type without touching the DB', async () => {
    router.resolve.mockReturnValue(null);
    const res = await service.ingestEvent(event(), 'cid');
    expect(res).toEqual({ success: false, correlationId: 'cid' });
    expect(await notifModel.countDocuments()).toBe(0);
    expect(router.dispatch).not.toHaveBeenCalled();
  });

  it('suppresses a duplicate event', async () => {
    guard.isFresh.mockResolvedValue(false);
    const res = await service.ingestEvent(event(), 'cid');
    expect(res.success).toBe(false);
    expect(router.dispatch).not.toHaveBeenCalled();
  });

  it('persists SUPPRESSED and skips dispatch when preferences suppress', async () => {
    prefRouter.route.mockResolvedValue(
      okDecision({ channels: [], suppressed: true, reason: 'muted' }),
    );
    const res = await service.ingestEvent(event(), 'cid');

    expect(res.success).toBe(true);
    expect(res.notificationId).toBeDefined();
    const notif = await notifModel.findById(res.notificationId).lean();
    expect(notif?.status).toBe(NotificationStatus.SUPPRESSED);
    expect(router.dispatch).not.toHaveBeenCalled();
  });

  it('dispatches all channels on the happy path', async () => {
    const res = await service.ingestEvent(event(), 'cid');

    expect(res.success).toBe(true);
    const notif = await notifModel.findById(res.notificationId).lean();
    expect(notif?.status).toBe(NotificationStatus.PENDING);
    expect(router.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'order.placed' }),
      res.notificationId,
      [ChannelType.EMAIL, ChannelType.SMS],
      EventPriority.NORMAL,
    );
    expect(digest.buffer).not.toHaveBeenCalled();
  });

  it('diverts EMAIL into a digest and dispatches only the remaining channels', async () => {
    prefRouter.route.mockResolvedValue(
      okDecision({ digestMode: DigestMode.DAILY }),
    );
    const res = await service.ingestEvent(event(), 'cid');

    expect(digest.buffer).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: DigestMode.DAILY,
        to: 'a@b.com',
        notificationId: res.notificationId,
      }),
    );

    expect(router.dispatch).toHaveBeenCalledWith(
      expect.anything(),
      res.notificationId,
      [ChannelType.SMS],
      EventPriority.NORMAL,
    );
  });

  it('does not dispatch when digest diversion empties the channel list', async () => {
    prefRouter.route.mockResolvedValue(
      okDecision({
        channels: [ChannelType.EMAIL],
        digestMode: DigestMode.HOURLY,
      }),
    );
    const res = await service.ingestEvent(event(), 'cid');

    expect(digest.buffer).toHaveBeenCalled();
    expect(router.dispatch).not.toHaveBeenCalled();
    expect(res.success).toBe(true);
  });
});
