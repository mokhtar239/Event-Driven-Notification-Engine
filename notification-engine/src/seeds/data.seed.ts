import { Connection, Types } from 'mongoose';
import {
  Notification,
  NotificationSchema,
} from '../modules/delivery/schemas/notification.schema';
import {
  DeliveryLog,
  DeliveryLogSchema,
} from '../modules/delivery/schemas/delivery-log.schema';
import {
  DeadLetter,
  DeadLetterSchema,
} from '../modules/delivery/schemas/dead-letter.schema';
import {
  UserPreference,
  UserPreferenceSchema,
} from '../modules/preferences/schemas/user-preference.schema';
import {
  InappNotification,
  InappNotificationSchema,
} from '../modules/channels/inapp/schemas/inapp-notification.schema';
import { ChannelType } from '../common/enums/channel-type.enum';
import {
  DeliveryStatus,
  NotificationStatus,
} from '../common/enums/delivery-status.enum';
import { EventPriority } from '../common/enums/event-priority.enum';

const TENANT = 'default';

const USERS = [
  { userId: 'user-alice', email: 'alice@example.com', phone: '+14155550101' },
  { userId: 'user-bob', email: 'bob@example.com', phone: '+14155550102' },
  { userId: 'user-carol', email: 'carol@example.com', phone: '+14155550103' },
  { userId: 'user-dave', email: 'dave@example.com', phone: '+14155550104' },
];

function model<T>(connection: Connection, name: string, schema: any) {
  return (connection.models[name] || connection.model(name, schema)) as any;
}

export async function seedData(connection: Connection) {
  const NotificationModel = model(
    connection,
    Notification.name,
    NotificationSchema,
  );
  const DeliveryLogModel = model(
    connection,
    DeliveryLog.name,
    DeliveryLogSchema,
  );
  const DeadLetterModel = model(connection, DeadLetter.name, DeadLetterSchema);
  const UserPreferenceModel = model(
    connection,
    UserPreference.name,
    UserPreferenceSchema,
  );
  const InappNotificationModel = model(
    connection,
    InappNotification.name,
    InappNotificationSchema,
  );

  // Start clean so re-running the seed is deterministic.
  await Promise.all([
    NotificationModel.deleteMany({ tenantId: TENANT }),
    DeliveryLogModel.deleteMany({ tenantId: TENANT }),
    DeadLetterModel.deleteMany({ tenantId: TENANT }),
    UserPreferenceModel.deleteMany({ tenantId: TENANT }),
    InappNotificationModel.deleteMany({}),
  ]);

  // ---- user_preferences ----------------------------------------------------
  await UserPreferenceModel.insertMany([
    {
      userId: 'user-alice',
      tenantId: TENANT,
      channels: { email: true, sms: true, push: true, inapp: true },
      quietHours: { start: '22:00', end: '08:00', timezone: 'America/New_York' },
      digestMode: 'instant',
      mutedEvents: [],
    },
    {
      userId: 'user-bob',
      tenantId: TENANT,
      channels: { email: true, sms: false, push: true, inapp: true },
      quietHours: { timezone: 'UTC' },
      digestMode: 'daily',
      mutedEvents: ['friend.request'],
    },
    {
      userId: 'user-carol',
      tenantId: TENANT,
      channels: { email: false, sms: false, push: false, inapp: true },
      quietHours: { timezone: 'UTC' },
      digestMode: 'hourly',
      mutedEvents: ['marketing.*'],
    },
    {
      userId: 'user-dave',
      tenantId: TENANT,
      channels: { email: true, sms: true, push: true, inapp: true },
      quietHours: { timezone: 'Europe/London' },
      digestMode: 'instant',
      mutedEvents: [],
    },
  ]);

  // ---- notifications + delivery_logs --------------------------------------
  // Each entry describes a notification and the outcome of every channel, so the
  // parent status matches what rollupNotification() would compute.
  type ChannelOutcome = {
    channel: ChannelType;
    status: DeliveryStatus;
    attempts: number;
    lastError?: string;
  };

  const scenarios: Array<{
    user: (typeof USERS)[number];
    eventType: string;
    priority: EventPriority;
    status: NotificationStatus;
    outcomes: ChannelOutcome[];
    ageMinutes: number;
  }> = [
    {
      user: USERS[0],
      eventType: 'user.signup',
      priority: EventPriority.NORMAL,
      status: NotificationStatus.SENT,
      ageMinutes: 60 * 24 * 3,
      outcomes: [
        { channel: ChannelType.EMAIL, status: DeliveryStatus.DELIVERED, attempts: 1 },
        { channel: ChannelType.INAPP, status: DeliveryStatus.DELIVERED, attempts: 1 },
      ],
    },
    {
      user: USERS[0],
      eventType: 'order.placed',
      priority: EventPriority.NORMAL,
      status: NotificationStatus.PARTIAL,
      ageMinutes: 60 * 5,
      outcomes: [
        { channel: ChannelType.EMAIL, status: DeliveryStatus.DELIVERED, attempts: 1 },
        {
          channel: ChannelType.SMS,
          status: DeliveryStatus.FAILED,
          attempts: 5,
          lastError: 'SMS provider temporarily unavailable',
        },
        { channel: ChannelType.INAPP, status: DeliveryStatus.DELIVERED, attempts: 1 },
      ],
    },
    {
      user: USERS[1],
      eventType: 'order.shipped',
      priority: EventPriority.NORMAL,
      status: NotificationStatus.SENT,
      ageMinutes: 60 * 8,
      outcomes: [
        { channel: ChannelType.SMS, status: DeliveryStatus.DELIVERED, attempts: 2 },
        { channel: ChannelType.PUSH, status: DeliveryStatus.DELIVERED, attempts: 1 },
      ],
    },
    {
      user: USERS[1],
      eventType: 'payment.failed',
      priority: EventPriority.HIGH,
      status: NotificationStatus.FAILED,
      ageMinutes: 60 * 2,
      outcomes: [
        {
          channel: ChannelType.EMAIL,
          status: DeliveryStatus.DLQ,
          attempts: 3,
          lastError: 'Invalid \'to\' address: bademail',
        },
        {
          channel: ChannelType.SMS,
          status: DeliveryStatus.DLQ,
          attempts: 5,
          lastError: 'SMS provider temporarily unavailable',
        },
      ],
    },
    {
      user: USERS[2],
      eventType: 'friend.request',
      priority: EventPriority.LOW,
      status: NotificationStatus.SENT,
      ageMinutes: 45,
      outcomes: [
        { channel: ChannelType.INAPP, status: DeliveryStatus.DELIVERED, attempts: 1 },
      ],
    },
    {
      user: USERS[2],
      eventType: 'order.placed',
      priority: EventPriority.NORMAL,
      status: NotificationStatus.SUPPRESSED,
      ageMinutes: 30,
      // All channels opted out (carol disabled email + sms) → suppressed, no logs.
      outcomes: [],
    },
    {
      user: USERS[3],
      eventType: 'order.placed',
      priority: EventPriority.NORMAL,
      status: NotificationStatus.PROCESSING,
      ageMinutes: 2,
      outcomes: [
        { channel: ChannelType.EMAIL, status: DeliveryStatus.DELIVERED, attempts: 1 },
        { channel: ChannelType.SMS, status: DeliveryStatus.PROCESSING, attempts: 1 },
        { channel: ChannelType.INAPP, status: DeliveryStatus.QUEUED, attempts: 0 },
      ],
    },
  ];

  let notifCount = 0;
  let logCount = 0;

  for (const s of scenarios) {
    const createdAt = new Date(Date.now() - s.ageMinutes * 60_000);
    const channels = s.outcomes.length
      ? s.outcomes.map((o) => o.channel)
      : [ChannelType.EMAIL, ChannelType.SMS, ChannelType.INAPP];

    const notif = await NotificationModel.create({
      eventType: s.eventType,
      userId: s.user.userId,
      tenantId: TENANT,
      data: {
        email: s.user.email,
        phone: s.user.phone,
        firstName: s.user.userId.replace('user-', ''),
        orderId: `ORD-${1000 + notifCount}`,
        total: 49.99 + notifCount,
      },
      channels,
      status: s.status,
      priority: s.priority,
      correlationId: new Types.ObjectId().toString(),
      createdAt,
      updatedAt: createdAt,
    });
    notifCount++;

    for (const o of s.outcomes) {
      const deliveredAt =
        o.status === DeliveryStatus.DELIVERED
          ? new Date(createdAt.getTime() + (300 + Math.random() * 1500))
          : undefined;
      await DeliveryLogModel.create({
        notificationId: notif._id,
        tenantId: TENANT,
        channel: o.channel,
        status: o.status,
        attempts: o.attempts,
        lastError: o.lastError,
        externalMessageId:
          o.status === DeliveryStatus.DELIVERED
            ? `sim-${new Types.ObjectId().toString()}`
            : undefined,
        deliveredAt,
        createdAt,
        updatedAt: deliveredAt ?? createdAt,
      });
      logCount++;

      // Mirror DLQ rows into the dead_letters collection.
      if (o.status === DeliveryStatus.DLQ) {
        await DeadLetterModel.create({
          notificationId: notif._id,
          tenantId: TENANT,
          channel: o.channel,
          payload: {
            NotificationId: notif._id.toString(),
            userId: s.user.userId,
            tenantId: TENANT,
            channel: o.channel,
            event: s.eventType,
            templateId: s.eventType,
            priority: s.priority,
            variables: { email: s.user.email, phone: s.user.phone },
            metadata: { correlationId: notif.correlationId },
          },
          error: o.lastError ?? 'retries exhausted',
          attempts: o.attempts,
          replayed: false,
          createdAt,
          updatedAt: createdAt,
        });
      }
    }
  }

  // ---- inapp_notifications (read/unread feed) ------------------------------
  await InappNotificationModel.insertMany([
    {
      userId: 'user-alice',
      subject: 'Welcome aboard',
      body: 'Welcome, alice! Tap here to complete your profile.',
      read: true,
    },
    {
      userId: 'user-alice',
      subject: 'Order confirmed',
      body: 'Your order #ORD-1001 for $50.99 is confirmed.',
      read: false,
    },
    {
      userId: 'user-carol',
      subject: 'New friend request',
      body: 'dave sent you a friend request.',
      read: false,
    },
    {
      userId: 'user-carol',
      subject: 'Order confirmed',
      body: 'Your order #ORD-1005 is confirmed.',
      read: false,
    },
  ]);

  console.log(
    `Data seeded — notifications: ${notifCount}, delivery_logs: ${logCount}, ` +
      `preferences: ${USERS.length}, inapp: 4, dead_letters: 2`,
  );
}
