import { EventRouter } from './event-ingestion.router';
import { ChannelType } from '../../common/enums/channel-type.enum';
import { EventPriority } from '../../common/enums/event-priority.enum';
import { NotificationEventDto } from '../../common/dto/notification-event.dto';

describe('EventRouter', () => {
  let router: EventRouter;
  let email: { add: jest.Mock };
  let sms: { add: jest.Mock };
  let push: { add: jest.Mock };
  let inapp: { add: jest.Mock };

  beforeEach(() => {
    email = { add: jest.fn() };
    sms = { add: jest.fn() };
    push = { add: jest.fn() };
    inapp = { add: jest.fn() };
    router = new EventRouter(
      email as any,
      sms as any,
      push as any,
      inapp as any,
    );
  });

  describe('resolve', () => {
    it('returns the route for a known event type', () => {
      const route = router.resolve('order.placed');
      expect(route).toEqual({
        channels: [ChannelType.EMAIL, ChannelType.SMS, ChannelType.INAPP],
        priority: EventPriority.NORMAL,
      });
    });

    it('marks payment.failed as HIGH priority', () => {
      expect(router.resolve('payment.failed')?.priority).toBe(
        EventPriority.HIGH,
      );
    });

    it('returns null for an unknown event type', () => {
      expect(router.resolve('does.not.exist')).toBeNull();
    });
  });

  describe('dispatch', () => {
    const event = {
      eventType: 'order.placed',
      userId: 'u1',
      tenantId: 't1',
      data: { email: 'a@b.com' },
    } as NotificationEventDto;

    it('enqueues a job on each given channel queue', async () => {
      await router.dispatch(
        event,
        'notif-1',
        [ChannelType.EMAIL, ChannelType.INAPP],
        EventPriority.NORMAL,
      );

      expect(email.add).toHaveBeenCalledTimes(1);
      expect(inapp.add).toHaveBeenCalledTimes(1);
      expect(sms.add).not.toHaveBeenCalled();
      expect(push.add).not.toHaveBeenCalled();
    });

    it('passes the notificationId and priority through the job', async () => {
      await router.dispatch(
        event,
        'notif-42',
        [ChannelType.EMAIL],
        EventPriority.HIGH,
      );

      const [jobName, jobData, opts] = email.add.mock.calls[0];
      expect(jobName).toBe('send');
      expect(jobData.NotificationId).toBe('notif-42');
      expect(jobData.priority).toBe(EventPriority.HIGH);
      expect(opts.priority).toBe(EventPriority.HIGH);
    });

    it('does nothing when the channel list is empty', async () => {
      await router.dispatch(event, 'notif-1', [], EventPriority.NORMAL);

      expect(email.add).not.toHaveBeenCalled();
      expect(sms.add).not.toHaveBeenCalled();
    });
  });
});
