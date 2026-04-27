import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envSchema } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { TemplateModule } from './modules/template/template.module';
import { DeliveryModule } from './modules/delivery/delivery.module';
import { PreferencesModule } from './modules/preferences/preferences.module';
import { EventIngestionModule } from './modules/event-ingestion/event-ingestion.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
    }),
    BullModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
        },
      }),
      inject: [ConfigService],
    }),
    HealthModule,
    TemplateModule,
    DeliveryModule,
    PreferencesModule,
    EventIngestionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
