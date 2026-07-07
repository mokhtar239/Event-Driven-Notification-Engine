import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { InappService } from './inapp.service';
import {
  InappNotification,
  InappNotificationSchema,
  InappNotificationDocument,
} from './schemas/inapp-notification.schema';
import { ChannelPayload } from '@common/interfaces/channel.interface';

describe('InappService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: InappService;
  let model: Model<InappNotificationDocument>;
  let randomSpy: jest.SpyInstance;

  const payload: ChannelPayload = {
    to: 'user-1',
    subject: 'Hi',
    body: 'You have a new order',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: InappNotification.name, schema: InappNotificationSchema },
        ]),
      ],
      providers: [InappService],
    }).compile();

    service = moduleRef.get(InappService);
    model = moduleRef.get(getModelToken(InappNotification.name));
  });

  beforeEach(() => {
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(async () => {
    randomSpy.mockRestore();
    await model.deleteMany({});
  });

  afterAll(async () => {
    await mongod.stop();
  });

  it('persists an unread notification and returns its id', async () => {
    const res = await service.send(payload);

    expect(res.success).toBe(true);
    const doc = await model.findById(res.messageId).lean();
    expect(doc?.userId).toBe('user-1');
    expect(doc?.body).toBe('You have a new order');
    expect(doc?.read).toBe(false);
  });

  it('throws a transient error and writes nothing when the store hiccups', async () => {
    randomSpy.mockReturnValue(0.001);

    await expect(service.send(payload)).rejects.toMatchObject({
      code: 'ECONNRESET',
    });
    expect(await model.countDocuments()).toBe(0);
  });
});
