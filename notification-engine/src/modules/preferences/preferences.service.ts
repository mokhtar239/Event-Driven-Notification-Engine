import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserPreference,
  UserPreferenceDocument,
} from './schemas/user-preference.schema';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectModel(UserPreference.name)
    private readonly prefModel: Model<UserPreferenceDocument>,
  ) {}


  async getOrCreate(
    tenantId: string,
    userId: string,
  ): Promise<UserPreferenceDocument> {
    return this.prefModel
      .findOneAndUpdate(
        { tenantId, userId },
        { $setOnInsert: { tenantId, userId } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      )
      .exec();
  }

  
  async update(
    tenantId: string,
    userId: string,
    dto: UpdatePreferencesDto,
  ): Promise<UserPreferenceDocument> {
    await this.getOrCreate(tenantId, userId);

    const set: Record<string, unknown> = {};

    if (dto.channels) {
      for (const [key, value] of Object.entries(dto.channels)) {
        if (value !== undefined) set[`channels.${key}`] = value;
      }
    }

    if (dto.quietHours) {
      for (const [key, value] of Object.entries(dto.quietHours)) {
        if (value !== undefined) set[`quietHours.${key}`] = value;
      }
    }

    if (dto.digestMode !== undefined) set.digestMode = dto.digestMode;
    if (dto.mutedEvents !== undefined) set.mutedEvents = dto.mutedEvents;

    const updated = await this.prefModel
      .findOneAndUpdate({ tenantId, userId }, { $set: set }, { new: true })
      .exec();

    if (!updated) {
      throw new NotFoundException(
        `Preferences not found for tenantId=${tenantId}, userId=${userId}`,
      );
    }
    return updated;
  }
}
