import { PreferenceRouter } from './preference-router.service';
import { PreferencesService } from './preferences.service';
import { DigestMode } from './schemas/user-preference.schema';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { EventPriority } from '../../common/enums/event-priority.enum';

/**
 * Unit tests for PreferenceRouter — pure decision logic.
 *
 * PreferencesService is the only dependency and it just returns a prefs doc, so
 * we mock it with a plain object instead of spinning up a NestJS testing module
 * or a database. Each test arranges a fake prefs result, runs route(), and
 * asserts on the returned decision.
 */
describe('PreferenceRouter', () => {
  let router: PreferenceRouter;
  let getOrCreate: jest.Mock;

  // Helper to build a prefs doc with sensible defaults, overridable per test.
  const prefs = (overrides: Partial<Record<string, unknown>> = {}) => ({
    channels: { email: true, sms: true, push: true, inapp: true },
    quietHours: { timezone: 'UTC' },
    mutedEvents: [],
    digestMode: DigestMode.INSTANT,
    ...overrides,
  });

  beforeEach(() => {
    getOrCreate = jest.fn();
    const preferences = { getOrCreate } as unknown as PreferencesService;
    router = new PreferenceRouter(preferences);
  });

  it('keeps all candidate channels when nothing is opted out or muted', async () => {
    getOrCreate.mockResolvedValue(prefs());

    const decision = await router.route(
      't1',
      'u1',
      'order.placed',
      [ChannelType.EMAIL, ChannelType.SMS, ChannelType.INAPP],
      EventPriority.NORMAL,
    );

    expect(decision.suppressed).toBe(false);
    expect(decision.channels).toEqual([
      ChannelType.EMAIL,
      ChannelType.SMS,
      ChannelType.INAPP,
    ]);
  });

  it('drops a channel the user opted out of', async () => {
    getOrCreate.mockResolvedValue(
      prefs({ channels: { email: true, sms: false, push: true, inapp: true } }),
    );

    const decision = await router.route(
      't1',
      'u1',
      'order.placed',
      [ChannelType.EMAIL, ChannelType.SMS, ChannelType.INAPP],
      EventPriority.NORMAL,
    );

    expect(decision.channels).toEqual([ChannelType.EMAIL, ChannelType.INAPP]);
    expect(decision.suppressed).toBe(false);
  });

  it('suppresses entirely when every channel is opted out', async () => {
    getOrCreate.mockResolvedValue(
      prefs({
        channels: { email: false, sms: false, push: false, inapp: false },
      }),
    );

    const decision = await router.route(
      't1',
      'u1',
      'order.placed',
      [ChannelType.EMAIL, ChannelType.SMS],
      EventPriority.NORMAL,
    );

    expect(decision.channels).toEqual([]);
    expect(decision.suppressed).toBe(true);
  });

  describe('muted events', () => {
    it('suppresses an exact muted event', async () => {
      getOrCreate.mockResolvedValue(prefs({ mutedEvents: ['friend.request'] }));

      const decision = await router.route(
        't1',
        'u1',
        'friend.request',
        [ChannelType.INAPP],
        EventPriority.LOW,
      );

      expect(decision.suppressed).toBe(true);
      expect(decision.channels).toEqual([]);
    });

    it('suppresses via trailing wildcard (marketing.*)', async () => {
      getOrCreate.mockResolvedValue(prefs({ mutedEvents: ['marketing.*'] }));

      const decision = await router.route(
        't1',
        'u1',
        'marketing.promo',
        [ChannelType.EMAIL],
        EventPriority.NORMAL,
      );

      expect(decision.suppressed).toBe(true);
    });

    it('does NOT mute a non-matching event', async () => {
      getOrCreate.mockResolvedValue(prefs({ mutedEvents: ['marketing.*'] }));

      const decision = await router.route(
        't1',
        'u1',
        'order.placed',
        [ChannelType.EMAIL],
        EventPriority.NORMAL,
      );

      expect(decision.suppressed).toBe(false);
      expect(decision.channels).toEqual([ChannelType.EMAIL]);
    });

    it('HIGH priority bypasses a mute', async () => {
      getOrCreate.mockResolvedValue(prefs({ mutedEvents: ['payment.failed'] }));

      const decision = await router.route(
        't1',
        'u1',
        'payment.failed',
        [ChannelType.EMAIL, ChannelType.SMS],
        EventPriority.HIGH,
      );

      expect(decision.suppressed).toBe(false);
      expect(decision.channels).toEqual([ChannelType.EMAIL, ChannelType.SMS]);
    });
  });

  describe('quiet hours', () => {
    // Build a window guaranteed to contain "now" in UTC so the test is stable
    // regardless of when it runs.
    const windowAroundNow = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const start = pad((now.getUTCHours() + 23) % 24); // 1h ago
      const end = pad((now.getUTCHours() + 1) % 24); // 1h ahead
      return { start: `${start}:00`, end: `${end}:00`, timezone: 'UTC' };
    };

    it('suppresses a normal event inside quiet hours', async () => {
      getOrCreate.mockResolvedValue(prefs({ quietHours: windowAroundNow() }));

      const decision = await router.route(
        't1',
        'u1',
        'order.placed',
        [ChannelType.EMAIL],
        EventPriority.NORMAL,
      );

      expect(decision.suppressed).toBe(true);
      expect(decision.reason).toContain('quiet hours');
    });

    it('HIGH priority bypasses quiet hours', async () => {
      getOrCreate.mockResolvedValue(prefs({ quietHours: windowAroundNow() }));

      const decision = await router.route(
        't1',
        'u1',
        'payment.failed',
        [ChannelType.EMAIL, ChannelType.SMS],
        EventPriority.HIGH,
      );

      expect(decision.suppressed).toBe(false);
      expect(decision.channels).toEqual([ChannelType.EMAIL, ChannelType.SMS]);
    });

    it('does not apply when start/end are unset', async () => {
      getOrCreate.mockResolvedValue(prefs({ quietHours: { timezone: 'UTC' } }));

      const decision = await router.route(
        't1',
        'u1',
        'order.placed',
        [ChannelType.EMAIL],
        EventPriority.NORMAL,
      );

      expect(decision.suppressed).toBe(false);
    });
  });

  it('surfaces the user digestMode on the decision', async () => {
    getOrCreate.mockResolvedValue(prefs({ digestMode: DigestMode.DAILY }));

    const decision = await router.route(
      't1',
      'u1',
      'order.placed',
      [ChannelType.EMAIL],
      EventPriority.NORMAL,
    );

    expect(decision.digestMode).toBe(DigestMode.DAILY);
  });
});
