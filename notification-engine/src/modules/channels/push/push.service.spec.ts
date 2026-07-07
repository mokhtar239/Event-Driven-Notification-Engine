import { PushService } from './push.service';
import { ChannelPayload } from '@common/interfaces/channel.interface';

describe('PushService', () => {
  let service: PushService;
  let randomSpy: jest.SpyInstance;

  const payload = (to: string): ChannelPayload => ({ to, body: 'hi' });

  beforeEach(() => {
    service = new PushService();
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => randomSpy.mockRestore());

  it('sends to a valid device token and returns an FCM-style message id', async () => {
    const res = await service.send(payload('a-valid-token-1234567890'));
    expect(res.success).toBe(true);
    expect(res.messageId).toMatch(/^projects\/sim\/messages\//);
  });

  it('throws a permanent invalid-token error for a short token', async () => {
    await expect(service.send(payload('short'))).rejects.toMatchObject({
      code: 'messaging/invalid-registration-token',
    });
  });

  it('throws a transient server-unavailable error when it randomly fails', async () => {
    randomSpy.mockReturnValue(0.001);
    await expect(
      service.send(payload('a-valid-token-1234567890')),
    ).rejects.toMatchObject({ code: 'messaging/server-unavailable' });
  });
});
