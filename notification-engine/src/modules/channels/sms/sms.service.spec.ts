import { SmsService } from './sms.service';
import { ChannelPayload } from '@common/interfaces/channel.interface';

describe('SmsService', () => {
  let service: SmsService;
  let randomSpy: jest.SpyInstance;

  const payload = (to: string): ChannelPayload => ({ to, body: 'hi' });

  beforeEach(() => {
    service = new SmsService();

    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => randomSpy.mockRestore());

  it('sends to a valid E.164 number and returns a Twilio-style sid', async () => {
    const res = await service.send(payload('+15551234567'));
    expect(res.success).toBe(true);
    expect(res.messageId).toMatch(/^SM[0-9a-f]{32}$/);
    expect(res.timestamp).toBeInstanceOf(Date);
  });

  it('throws a permanent error (code 21211) for an invalid number', async () => {
    await expect(service.send(payload('not-a-number'))).rejects.toMatchObject({
      code: 21211,
    });
  });

  it('throws a permanent error for a missing number', async () => {
    await expect(service.send(payload(''))).rejects.toMatchObject({
      code: 21211,
    });
  });

  it('throws a transient 503 when the provider randomly fails', async () => {
    randomSpy.mockReturnValue(0.001);
    await expect(service.send(payload('+15551234567'))).rejects.toMatchObject({
      statusCode: 503,
    });
  });
});
