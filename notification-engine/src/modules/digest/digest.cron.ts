import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';
import { DigestService } from './digest.service';
import { DigestMode } from '../preferences/schemas/user-preference.schema';

@Injectable()
export class DigestCron {
  private readonly logger = new Logger(DigestCron.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly digest: DigestService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async hourly(): Promise<void> {
    await this.runLocked('digest:lock:hourly', 55 * 60, DigestMode.HOURLY);
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async daily(): Promise<void> {
    await this.runLocked('digest:lock:daily', 23 * 60 * 60, DigestMode.DAILY);
  }

  private async runLocked(
    lockKey: string,
    ttlSeconds: number,
    mode: DigestMode,
  ): Promise<void> {
    const token = `${process.pid}-${Date.now()}`;
    const acquired = await this.redis.set(
      lockKey,
      token,
      'EX',
      ttlSeconds,
      'NX',
    );

    if (acquired !== 'OK') {
      this.logger.log(
        `Digest ${mode}: lock held by another instance — skipping`,
      );
      return;
    }

    this.logger.log(`Digest ${mode}: lock acquired — running flush`);
    try {
      const sent = await this.digest.flush(mode);
      this.logger.log(
        `Digest ${mode}: flush complete — ${sent} digest(s) sent`,
      );
    } catch (err) {
      this.logger.error(
        `Digest ${mode}: flush errored: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    } finally {
      await this.releaseIfOwner(lockKey, token);
    }
  }

  private async releaseIfOwner(lockKey: string, token: string): Promise<void> {
    const script =
      'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';
    await this.redis.eval(script, 1, lockKey, token);
  }
}
