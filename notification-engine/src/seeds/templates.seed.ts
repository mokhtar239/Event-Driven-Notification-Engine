import { Connection } from 'mongoose';
import {
  Template,
  TemplateSchema,
} from '../modules/template/schemas/template.schema';
import { ChannelType } from '../common/enums/channel-type.enum';

interface SeedTemplate {
  tenantId: string;
  eventType: string;
  channel: ChannelType;
  subject?: string;
  body: string;
}

const TEMPLATES: SeedTemplate[] = [
  {
    tenantId: 'default',
    eventType: 'user.signup',
    channel: ChannelType.EMAIL,
    subject: 'Welcome to Acme, {{firstName}}!',
    body: 'Hi {{firstName}},\n\nThanks for signing up. Your account ({{email}}) is ready to use. Visit {{loginUrl}} to get started.\n\n— The Acme Team',
  },
  {
    tenantId: 'default',
    eventType: 'user.signup',
    channel: ChannelType.INAPP,
    subject: 'Welcome aboard',
    body: 'Welcome, {{firstName}}! Tap here to complete your profile.',
  },

  {
    tenantId: 'default',
    eventType: 'order.placed',
    channel: ChannelType.EMAIL,
    subject: 'Order #{{orderId}} confirmed',
    body: "Hi {{firstName}},\n\nYour order #{{orderId}} for {{currency total}} has been confirmed. We'll email tracking details once it ships.\n\nItems: {{itemCount}}\n\nThank you for shopping with us.",
  },
  {
    tenantId: 'default',
    eventType: 'order.placed',
    channel: ChannelType.SMS,
    body: 'Acme: Order #{{orderId}} confirmed. Total {{currency total}}. Track at {{trackingUrl}}',
  },
  {
    tenantId: 'default',
    eventType: 'order.placed',
    channel: ChannelType.INAPP,
    subject: 'Order confirmed',
    body: 'Your order #{{orderId}} for {{currency total}} is confirmed.',
  },

  {
    tenantId: 'default',
    eventType: 'order.shipped',
    channel: ChannelType.SMS,
    body: 'Acme: Order #{{orderId}} shipped via {{carrier}}. Track: {{trackingUrl}}',
  },
  {
    tenantId: 'default',
    eventType: 'order.shipped',
    channel: ChannelType.PUSH,
    subject: 'Your order is on the way',
    body: 'Order #{{orderId}} shipped via {{carrier}}. Estimated delivery: {{eta}}.',
  },

  {
    tenantId: 'default',
    eventType: 'payment.failed',
    channel: ChannelType.EMAIL,
    subject: 'Payment failed for order #{{orderId}}',
    body: 'Hi {{firstName}},\n\nWe were unable to process your payment of {{currency amount}} for order #{{orderId}}. Reason: {{reason}}.\n\nPlease update your payment method at {{retryUrl}} within 24 hours to avoid cancellation.',
  },
  {
    tenantId: 'default',
    eventType: 'payment.failed',
    channel: ChannelType.SMS,
    body: 'Acme: Payment of {{currency amount}} for order #{{orderId}} failed. Update at {{retryUrl}}',
  },

  {
    tenantId: 'default',
    eventType: 'friend.request',
    channel: ChannelType.INAPP,
    subject: 'New friend request',
    body: '{{actorName}} sent you a friend request.',
  },

  {
    tenantId: 'default',
    eventType: 'weekly.digest',
    channel: ChannelType.EMAIL,
    subject: 'Your weekly digest — {{weekOf}}',
    body: "Hi {{firstName}},\n\nHere's what you missed this week:\n\n- {{newOrdersCount}} new orders\n- {{messagesCount}} unread messages\n- {{notificationsCount}} other notifications\n\nView all at {{dashboardUrl}}",
  },
];

export async function seedTemplates(connection: Connection) {
  const TemplateModel =
    connection.models[Template.name] ||
    connection.model(Template.name, TemplateSchema);

  let inserted = 0;
  let updated = 0;
  for (const tpl of TEMPLATES) {
    const result = await TemplateModel.updateOne(
      {
        tenantId: tpl.tenantId,
        eventType: tpl.eventType,
        channel: tpl.channel,
        version: 1,
      },
      {
        $set: {
          ...tpl,
          version: 1,
          isActive: true,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount) inserted++;
    else if (result.modifiedCount) updated++;
  }
  console.log(
    `Templates seeded — inserted: ${inserted}, updated: ${updated}, total: ${TEMPLATES.length}`,
  );
}
