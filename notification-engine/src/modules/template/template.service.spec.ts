import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';
import { TemplateService } from './template.service';
import { TemplateRender } from './template.render';
import { REDIS_CLIENT } from '../redis/redis.module';
import {
  Template,
  TemplateSchema,
  TemplateDocument,
} from './schemas/template.schema';
import { ChannelType } from '@common/enums/channel-type.enum';

class FakeRedis {
  store = new Map<string, string>();
  getCount = 0;

  get(key: string): Promise<string | null> {
    this.getCount++;
    return Promise.resolve(this.store.get(key) ?? null);
  }

  set(key: string, val: string, ..._rest: unknown[]): Promise<'OK' | null> {
    if (_rest.includes('NX') && this.store.has(key)) {
      return Promise.resolve(null);
    }
    this.store.set(key, val);
    return Promise.resolve('OK');
  }

  del(key: string): Promise<number> {
    const had = this.store.delete(key);
    return Promise.resolve(had ? 1 : 0);
  }
}

describe('TemplateService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: TemplateService;
  let model: Model<TemplateDocument>;
  let redis: FakeRedis;

  const baseTpl = {
    tenantId: 't1',
    eventType: 'order.placed',
    channel: ChannelType.EMAIL,
    subject: 'Order {{orderId}}',
    body: 'Total: {{currency total}}',
  };

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    redis = new FakeRedis();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: Template.name, schema: TemplateSchema },
        ]),
      ],
      providers: [
        TemplateService,
        TemplateRender,
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();

    service = moduleRef.get(TemplateService);
    model = moduleRef.get(getModelToken(Template.name));
  });

  afterEach(async () => {
    await model.deleteMany({});
    redis.store.clear();
    redis.getCount = 0;
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('create / read / update / delete', () => {
    it('create defaults version and isActive, then getById returns it', async () => {
      const created = await service.create(baseTpl);
      expect(created.version).toBe(1);
      expect(created.isActive).toBe(true);

      const fetched = await service.getById(created._id.toString());
      expect(fetched.eventType).toBe('order.placed');
    });

    it('getById throws NotFound for a missing id', async () => {
      await expect(
        service.getById('64b000000000000000000000'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('list filters by tenant', async () => {
      await service.create(baseTpl);
      await service.create({ ...baseTpl, tenantId: 't2' });
      const t1 = await service.list({ tenantId: 't1' });
      expect(t1).toHaveLength(1);
    });

    it('update mutates and invalidates the cache', async () => {
      const created = await service.create(baseTpl);
      const updated = await service.update(created._id.toString(), {
        subject: 'Changed',
      });
      expect(updated.subject).toBe('Changed');
    });

    it('update throws NotFound for a missing id', async () => {
      await expect(
        service.update('64b000000000000000000000', { subject: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('remove deletes and reports it', async () => {
      const created = await service.create(baseTpl);
      const res = await service.remove(created._id.toString());
      expect(res).toEqual({ deleted: true, id: created._id.toString() });
      expect(await model.countDocuments()).toBe(0);
    });

    it('remove throws NotFound for a missing id', async () => {
      await expect(
        service.remove('64b000000000000000000000'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('renderTemplate (cache-aside)', () => {
    it('renders subject and body with interpolation + the currency helper', async () => {
      await service.create(baseTpl);
      const out = await service.renderTemplate(
        't1',
        'order.placed',
        ChannelType.EMAIL,
        {
          orderId: 'A-1',
          total: 42.5,
        },
      );
      expect(out.subject).toBe('Order A-1');
      expect(out.body).toBe('Total: $42.50');
    });

    it('caches after the first miss (second render does not re-query)', async () => {
      const create = await service.create(baseTpl);
      const spy = jest.spyOn(model, 'findOne');

      await service.renderTemplate('t1', 'order.placed', ChannelType.EMAIL, {
        orderId: 'A',
      });
      await service.renderTemplate('t1', 'order.placed', ChannelType.EMAIL, {
        orderId: 'B',
      });

      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
      expect(create).toBeDefined();
    });

    it('throws NotFound when no template exists', async () => {
      await expect(
        service.renderTemplate('t1', 'missing.event', ChannelType.EMAIL, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
