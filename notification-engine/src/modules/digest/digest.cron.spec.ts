import { DigestCron } from './digest.cron';
import { DigestService } from './digest.service';
import { DigestMode } from '../preferences/schemas/user-preference.schema';

describe('DigestCron', () => {
  let redis: { set: jest.Mock; eval: jest.Mock };
  let digest: { flush: jest.Mock };
  let cron: DigestCron;

  beforeEach(() => {
    redis = { set: jest.fn(), eval: jest.fn().mockResolvedValue(1) };
    digest = { flush: jest.fn().mockResolvedValue(2) };
    cron = new DigestCron(redis as any, digest as unknown as DigestService);
  });

  it('runs the flush when it acquires the lock', async () => {
    redis.set.mockResolvedValue('OK');

    await cron.hourly();

    expect(redis.set).toHaveBeenCalledWith(
      'digest:lock:hourly',
      expect.any(String),
      'EX',
      expect.any(Number),
      'NX',
    );
    expect(digest.flush).toHaveBeenCalledWith(DigestMode.HOURLY);

    expect(redis.eval).toHaveBeenCalled();
  });

  it('skips the flush when another instance holds the lock', async () => {
    redis.set.mockResolvedValue(null);

    await cron.hourly();

    expect(digest.flush).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('daily() flushes the DAILY bucket', async () => {
    redis.set.mockResolvedValue('OK');

    await cron.daily();

    expect(digest.flush).toHaveBeenCalledWith(DigestMode.DAILY);
  });

  it('still releases the lock if flush throws', async () => {
    redis.set.mockResolvedValue('OK');
    digest.flush.mockRejectedValue(new Error('boom'));

    await cron.hourly();

    expect(redis.eval).toHaveBeenCalled();
  });
});
