import { Test } from '@nestjs/testing';
import { MongooseModule, getModelToken } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Model } from 'mongoose';
import { PreferencesService } from './preferences.service';
import {
  UserPreference,
  UserPreferenceSchema,
  UserPreferenceDocument,
  DigestMode,
} from './schemas/user-preference.schema';

/**
 * Integration tests for PreferencesService — runs against a real (in-memory)
 * MongoDB so the Mongoose queries, upserts, and defaults are exercised for real
 * rather than mocked. mongodb-memory-server downloads a Mongo binary on first
 * run and serves it from a temp dir; nothing touches your Docker instance.
 */
describe('PreferencesService (integration)', () => {
  let mongod: MongoMemoryServer;
  let service: PreferencesService;
  let model: Model<UserPreferenceDocument>;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(mongod.getUri()),
        MongooseModule.forFeature([
          { name: UserPreference.name, schema: UserPreferenceSchema },
        ]),
      ],
      providers: [PreferencesService],
    }).compile();

    service = moduleRef.get(PreferencesService);
    model = moduleRef.get(getModelToken(UserPreference.name));
  });

  afterEach(async () => {
    await model.deleteMany({});
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('getOrCreate', () => {
    it('creates a preference doc with defaults on first access', async () => {
      const doc = await service.getOrCreate('t1', 'u1');

      expect(doc.userId).toBe('u1');
      expect(doc.tenantId).toBe('t1');
      // Schema defaults: all channels on, instant digest, no mutes.
      expect(doc.channels.email).toBe(true);
      expect(doc.channels.sms).toBe(true);
      expect(doc.digestMode).toBe(DigestMode.INSTANT);
      expect(doc.mutedEvents).toEqual([]);
    });

    it('is idempotent — returns the same doc, does not duplicate', async () => {
      const first = await service.getOrCreate('t1', 'u1');
      const second = await service.getOrCreate('t1', 'u1');

      expect(String(second._id)).toBe(String(first._id));
      expect(await model.countDocuments({ tenantId: 't1', userId: 'u1' })).toBe(
        1,
      );
    });
  });

  describe('update', () => {
    it('updates only the provided channel flags', async () => {
      await service.getOrCreate('t1', 'u1');

      const updated = await service.update('t1', 'u1', {
        channels: { sms: false },
      });

      expect(updated.channels.sms).toBe(false);
      // Untouched flags keep their defaults.
      expect(updated.channels.email).toBe(true);
    });

    it('updates digestMode and mutedEvents', async () => {
      await service.getOrCreate('t1', 'u1');

      const updated = await service.update('t1', 'u1', {
        digestMode: DigestMode.DAILY,
        mutedEvents: ['marketing.*'],
      });

      expect(updated.digestMode).toBe(DigestMode.DAILY);
      expect(updated.mutedEvents).toEqual(['marketing.*']);
    });

    it('auto-creates the doc when updating a user with no prefs yet', async () => {
      const updated = await service.update('t1', 'new-user', {
        digestMode: DigestMode.HOURLY,
      });

      expect(updated.digestMode).toBe(DigestMode.HOURLY);
      expect(updated.userId).toBe('new-user');
    });
  });
});
