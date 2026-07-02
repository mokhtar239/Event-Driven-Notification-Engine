import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserPreference,
  UserPreferenceSchema,
} from './schemas/user-preference.schema';
import { PreferencesService } from './preferences.service';
import { PreferenceRouter } from './preference-router.service';
import { PreferencesController } from './preferences.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserPreference.name, schema: UserPreferenceSchema },
    ]),
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService, PreferenceRouter],
  exports: [PreferencesService, PreferenceRouter, MongooseModule],
})
export class PreferencesModule {}
