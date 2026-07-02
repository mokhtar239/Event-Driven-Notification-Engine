import { throwClassifiedSms } from './sms.errors';
import { UnrecoverableError } from 'bullmq';

/**
 * Unit tests for SMS (Twilio) error classification. Permanent Twilio codes and
 * permanent HTTP statuses must become UnrecoverableError (→ DLQ, no retry);
 * everything else re-throws as-is (→ retried by BullMQ).
 */
describe('throwClassifiedSms', () => {
  it('treats permanent Twilio codes as unrecoverable', () => {
    expect(() => throwClassifiedSms({ code: 21211 })).toThrow(
      UnrecoverableError,
    );
    expect(() => throwClassifiedSms({ code: 21610 })).toThrow(
      UnrecoverableError,
    );
  });

  it('treats permanent HTTP status as unrecoverable', () => {
    expect(() => throwClassifiedSms({ statusCode: 400 })).toThrow(
      UnrecoverableError,
    );
  });

  it('re-throws transient errors unchanged (retryable)', () => {
    const err = { statusCode: 503, message: 'provider unavailable' };
    expect(() => throwClassifiedSms(err)).toThrow();
    // Not an UnrecoverableError → BullMQ will retry it.
    try {
      throwClassifiedSms(err);
    } catch (e) {
      expect(e).not.toBeInstanceOf(UnrecoverableError);
    }
  });

  it('re-throws unknown shapes as transient', () => {
    const err = new Error('weird');
    try {
      throwClassifiedSms(err);
    } catch (e) {
      expect(e).not.toBeInstanceOf(UnrecoverableError);
      expect(e).toBe(err);
    }
  });
});
