import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { DigestService } from './digest.service';
import { EmailService } from '../channels/email/emailService';
import { DigestMode } from '../preferences/schemas/user-preference.schema';
import {
  DigestBatch,
  DigestBatchSchema,
  DigestBatchDocument,
  DigestItemStatus,
} from './schemas/digest-batch.schema';

describe('DigestService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: DigestService;
  let model: Model<DigestBatchDocument>;
  let email: { send: jest.Mock };

  const item = (over: Partial<Record<string, unknown>> = {}) => ({
    userId: 'u1',
    tenantId: 't1',
    mode: DigestMode.DAILY,
    eventType: 'order.placed',
    to: 'u1@example.com',
    summary: 'order #1',
    ...over,
  });

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    email = { send: jest.fn().mockResolvedValue({ success: true }) };

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: DigestBatch.name, schema: DigestBatchSchema },
        ]),
      ],
      providers: [DigestService, { provide: EmailService, useValue: email }],
    }).compile();

    service = moduleRef.get(DigestService);
    model = moduleRef.get(getModelToken(DigestBatch.name));
  });

  afterEach(async () => {
    await model.deleteMany({});
    email.send.mockClear();
    email.send.mockResolvedValue({ success: true });
  });

  afterAll(async () => {
    await mongod.stop();
  });

  it('buffers an item as PENDING', async () => {
    await service.buffer(item());

    const docs = await model.find().lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].status).toBe(DigestItemStatus.PENDING);
    expect(docs[0].to).toBe('u1@example.com');
  });

  it('flush sends one email per user and marks items SENT', async () => {
    await service.buffer(item({ summary: 'order #1' }));
    await service.buffer(item({ summary: 'order #2' }));

    const sent = await service.flush(DigestMode.DAILY);

    expect(sent).toBe(1);
    expect(email.send).toHaveBeenCalledTimes(1);

    const pending = await model.countDocuments({
      status: DigestItemStatus.PENDING,
    });
    expect(pending).toBe(0);
  });

  it('flush groups separate users into separate emails', async () => {
    await service.buffer(item({ userId: 'u1', to: 'u1@x.com' }));
    await service.buffer(item({ userId: 'u2', to: 'u2@x.com' }));

    const sent = await service.flush(DigestMode.DAILY);

    expect(sent).toBe(2);
    expect(email.send).toHaveBeenCalledTimes(2);
  });

  it('flush returns 0 and sends nothing when bucket is empty', async () => {
    const sent = await service.flush(DigestMode.HOURLY);

    expect(sent).toBe(0);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('leaves items PENDING when the email send fails', async () => {
    email.send.mockRejectedValueOnce(new Error('smtp down'));
    await service.buffer(item());

    const sent = await service.flush(DigestMode.DAILY);

    expect(sent).toBe(0);
    const pending = await model.countDocuments({
      status: DigestItemStatus.PENDING,
    });
    expect(pending).toBe(1);
  });

  it('only flushes the requested mode', async () => {
    await service.buffer(item({ mode: DigestMode.DAILY }));
    await service.buffer(item({ mode: DigestMode.HOURLY }));

    await service.flush(DigestMode.DAILY);

    const hourlyPending = await model.countDocuments({
      mode: DigestMode.HOURLY,
      status: DigestItemStatus.PENDING,
    });
    expect(hourlyPending).toBe(1);
  });
});
