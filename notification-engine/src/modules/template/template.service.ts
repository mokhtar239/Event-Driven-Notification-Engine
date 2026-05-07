import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Template, TemplateDocument } from './schemas/template.schema';
import { TemplateRender } from './template.render';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

const TEMPLATE_CACHE_TTL = 60 * 60; // 1 hour
const TEMPLATE_LOCK_TTL = 5; // 5 second

@Injectable()
export class TemplateService {
  constructor(
    @Inject(REDIS_CLIENT) private redisClient: Redis,
    @InjectModel(Template.name) private templateModel: Model<TemplateDocument>,
    private renderer: TemplateRender,
  ) {}

  private keyOfTemplate(
    tenantId: string,
    eventType: string,
    channel: string,
  ): string {
    const key = `template:${tenantId}:${eventType}:${channel}`;
    return key;
  }

  private async getTemplate(
    tenantId: string,
    eventType: string,
    channel: string,
  ) {
    const key = this.keyOfTemplate(tenantId, eventType, channel);
    const cached = await this.redisClient.get(key);
    if (cached) {
      const cachedTemplate = JSON.parse(cached) as TemplateDocument;
      return cachedTemplate;
    }
    const lockKey = `${key}:lock`;
    const gotLock = await this.redisClient.set(
      lockKey,
      '1',
      'EX',
      TEMPLATE_LOCK_TTL,
      'NX',
    );
    if (!gotLock) {
      // wait some time and retry
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached) as TemplateDocument;
        }
      }
    }
    // got lock , or retry failed, query db
    try {
      console.log('query db excute');
      const template = await this.templateModel
        .findOne({ tenantId, eventType, channel })
        .sort({ version: -1 })
        .lean();
      if (!template) {
        throw new NotFoundException(
          `Template not found for tenantId=${tenantId}, eventType=${eventType}, channel=${channel}`,
        );
      }
      const cacheValue = JSON.stringify(template);
      await this.redisClient.set(key, cacheValue, 'EX', TEMPLATE_CACHE_TTL);
      return template;
    } finally {
      if (gotLock) {
        await this.redisClient.del(lockKey);
      }
    }
  }
  async renderTemplate(
    tenantId: string,
    eventType: string,
    channel: string,
    vars: Record<string, unknown>,
  ) {
    const template = await this.getTemplate(tenantId, eventType, channel);
    const base = `${tenantId}:${eventType}:${channel}:${template.version}`;
    const subjectKey = `subject:${base}`;
    const contentKey = `body:${base}`;
    return {
      subject: template.subject
        ? this.renderer.renderCashed(subjectKey, template.subject, vars)
        : undefined,
      body: template.body
        ? this.renderer.renderCashed(contentKey, template.body, vars)
        : undefined,
    };
  }
  private async invalidateCache(
    tenantId: string,
    eventType: string,
    channel: string,
  ) {
    await this.redisClient.del(
      this.keyOfTemplate(tenantId, eventType, channel),
    );
  }

  async create(dto: CreateTemplateDto) {
    const created = await this.templateModel.create({
      ...dto,
      version: dto.version ?? 1,
      isActive: dto.isActive ?? true,
    });
    await this.invalidateCache(dto.tenantId, dto.eventType, dto.channel);
    return created;
  }

  async list(filter: {
    tenantId?: string;
    eventType?: string;
    channel?: string;
  }) {
    return this.templateModel.find(filter).lean();
  }

  async getById(id: string) {
    const tpl = await this.templateModel.findById(id).lean();
    if (!tpl) throw new NotFoundException(`Template ${id} not found`);
    return tpl;
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const tpl = await this.templateModel
      .findByIdAndUpdate(id, dto, { new: true })
      .lean();
    if (!tpl) throw new NotFoundException(`Template ${id} not found`);
    await this.invalidateCache(tpl.tenantId, tpl.eventType, tpl.channel);
    return tpl;
  }

  async remove(id: string) {
    const tpl = await this.templateModel.findByIdAndDelete(id).lean();
    if (!tpl) throw new NotFoundException(`Template ${id} not found`);
    await this.invalidateCache(tpl.tenantId, tpl.eventType, tpl.channel);
    return { deleted: true, id };
  }
}
