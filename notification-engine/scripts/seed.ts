import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../src/app.module';
import { Template } from '../src/modules/template/schemas/template.schema';
import { ChannelType } from '../src/common/enums/channel-type.enum';

const DEFAULT_TEMPLATES = [
  {
    eventType: 'user.signup',
    channel: ChannelType.EMAIL,
    tenantId: 'default',
    subject: 'Welcome to {{appName}}, {{user.firstName}}!',
    body: 'Hi {{user.firstName}}, your account is ready. Get started here: {{loginUrl}}',
  },
  {
    eventType: 'order.placed',
    channel: ChannelType.EMAIL,
    tenantId: 'default',
    subject: 'Order #{{order.id}} confirmed',
    body: 'Thanks for your order of {{order.total}}. We will notify you when it ships.',
  },
  {
    eventType: 'order.placed',
    channel: ChannelType.SMS,
    tenantId: 'default',
    body: 'Order #{{order.id}} confirmed: {{order.total}}',
  },
  {
    eventType: 'order.shipped',
    channel: ChannelType.SMS,
    tenantId: 'default',
    body: 'Your order #{{order.id}} has shipped. Track: {{trackingUrl}}',
  },
  {
    eventType: 'payment.failed',
    channel: ChannelType.EMAIL,
    tenantId: 'default',
    subject: 'Payment failed for order #{{order.id}}',
    body: 'Your payment of {{order.total}} failed. Please update your payment method: {{paymentUrl}}',
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const templateModel = app.get<Model<Template>>(getModelToken(Template.name));

  for (const tpl of DEFAULT_TEMPLATES) {
    await templateModel.updateOne(
      {
        eventType: tpl.eventType,
        channel: tpl.channel,
        tenantId: tpl.tenantId,
        version: 1,
      },
      { $setOnInsert: { ...tpl, version: 1, isActive: true } },
      { upsert: true },
    );
    console.log(`Seeded ${tpl.eventType} / ${tpl.channel}`);
  }

  await app.close();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});