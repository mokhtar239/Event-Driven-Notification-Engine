import { DigestCron } from './digest.cron';
import { DigestService } from './digest.service';
import { DigestMode } from '../preferences/schemas/user-preference.schema';

/**
 * Unit tests for DigestCron — focused on the distributed lock behavior, which
 * is the whole point of the cron in a multi-instance deployment. Redis and
 * DigestService are mocked.
 */
describe('DigestCron', () => {
  let redis: { set: jest.Mock; eval: jest.Mock };
  let digest: { flush: jest.Mock };
  let cron: DigestCron;

  beforeEach(() => {
    redis = { set: jest.fn(), eval: jest.fn().mockResolvedValue(1) };
    digest = { flush: jest.fn().mockResolvedValue(2) };
    cron = new DigestCron(
      redis as any,
      digest as unknown as DigestService,
    );
  });

  it('runs the flush when it acquires the lock', async () => {
    redis.set.mockResolvedValue('OK'); // lock acquired

    await cron.hourly();

    // Lock taken with NX + EX.
    expect(redis.set).toHaveBeenCalledWith(
      'digest:lock:hourly',
      expect.any(String),
      'EX',
      expect.any(Number),
      'NX',
    );
    expect(digest.flush).toHaveBeenCalledWith(DigestMode.HOURLY);
    // Lock released after the run.
    expect(redis.eval).toHaveBeenCalled();
  });

  it('skips the flush when another instance holds the lock', async () => {
    redis.set.mockResolvedValue(null); // SET NX failed → not acquired

    await cron.hourly();

    expect(digest.flush).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled(); // nothing to release
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

    // finally-block release still runs.
    expect(redis.eval).toHaveBeenCalled();
  });
});
