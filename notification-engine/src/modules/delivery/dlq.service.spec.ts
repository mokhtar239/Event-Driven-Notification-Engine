import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { getQueueToken } from '@nestjs/bullmq';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NotFoundException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import { DlqService } from './dlq.service';
import {
  DeadLetter,
  DeadLetterSchema,
  DeadLetterDocument,
} from './schemas/dead-letter.schema';
import { ChannelType } from '@common/enums/channel-type.enum';
import { NotificationJobData } from '@common/interfaces/notification-job.interface';

describe('DlqService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: DlqService;
  let dlqModel: Model<DeadLetterDocument>;

  const queues = {
    [ChannelType.EMAIL]: { add: jest.fn() },
    [ChannelType.SMS]: { add: jest.fn() },
    [ChannelType.PUSH]: { add: jest.fn() },
    [ChannelType.INAPP]: { add: jest.fn() },
  };

  const jobData = (): NotificationJobData => ({
    NotificationId: new Types.ObjectId().toString(),
    userId: 'u1',
    tenantId: 't1',
    channel: ChannelType.EMAIL,
    event: 'order.placed',
    templateId: 'tpl-1',
    priority: 3,
    variables: {},
    metadata: {},
  });

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: DeadLetter.name, schema: DeadLetterSchema },
        ]),
      ],
      providers: [
        DlqService,
        {
          provide: getQueueToken(ChannelType.EMAIL),
          useValue: queues[ChannelType.EMAIL],
        },
        {
          provide: getQueueToken(ChannelType.SMS),
          useValue: queues[ChannelType.SMS],
        },
        {
          provide: getQueueToken(ChannelType.PUSH),
          useValue: queues[ChannelType.PUSH],
        },
        {
          provide: getQueueToken(ChannelType.INAPP),
          useValue: queues[ChannelType.INAPP],
        },
      ],
    }).compile();

    service = moduleRef.get(DlqService);
    dlqModel = moduleRef.get(getModelToken(DeadLetter.name));
  });

  afterEach(async () => {
    await dlqModel.deleteMany({});
    Object.values(queues).forEach((q) => q.add.mockClear());
  });

  afterAll(async () => {
    await mongod.stop();
  });

  it('deadLetter persists a row with the error message and payload', async () => {
    const payload = jobData();
    await service.deadLetter(payload, ChannelType.EMAIL, new Error('boom'), 3);

    const rows = await dlqModel.find().lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].error).toBe('boom');
    expect(rows[0].attempts).toBe(3);
    expect(rows[0].replayed).toBe(false);
  });

  it('list filters by tenant and channel and hides replayed rows', async () => {
    await service.deadLetter(
      { ...jobData(), tenantId: 't1' },
      ChannelType.EMAIL,
      'e1',
      1,
    );
    await service.deadLetter(
      { ...jobData(), tenantId: 't2' },
      ChannelType.SMS,
      'e2',
      1,
    );

    const t1 = await service.list({ tenantId: 't1' });
    expect(t1).toHaveLength(1);
    expect(t1[0].tenantId).toBe('t1');

    const sms = await service.list({ channel: ChannelType.SMS });
    expect(sms).toHaveLength(1);
    expect(sms[0].channel).toBe(ChannelType.SMS);
  });

  it('replay re-enqueues onto the matching channel queue and marks the row replayed', async () => {
    const payload = { ...jobData(), channel: ChannelType.SMS };
    await service.deadLetter(payload, ChannelType.SMS, 'x', 5);
    const [row] = await dlqModel.find().lean();

    const res = await service.replay(row._id.toString());

    expect(res).toEqual({
      replayed: true,
      id: row._id.toString(),
      channel: ChannelType.SMS,
    });
    expect(queues[ChannelType.SMS].add).toHaveBeenCalledWith(
      'send',
      expect.objectContaining({ tenantId: 't1' }),
      { priority: 3 },
    );
    expect(queues[ChannelType.EMAIL].add).not.toHaveBeenCalled();

    const updated = await dlqModel.findById(row._id).lean();
    expect(updated?.replayed).toBe(true);

    expect(await service.list()).toHaveLength(0);
  });

  it('replay throws NotFound for an unknown id', async () => {
    await expect(
      service.replay(new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('discard deletes the row', async () => {
    await service.deadLetter(jobData(), ChannelType.EMAIL, 'x', 1);
    const [row] = await dlqModel.find().lean();

    const res = await service.discard(row._id.toString());
    expect(res).toEqual({ discarded: true, id: row._id.toString() });
    expect(await dlqModel.countDocuments()).toBe(0);
  });

  it('discard throws NotFound for an unknown id', async () => {
    await expect(
      service.discard(new Types.ObjectId().toString()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
