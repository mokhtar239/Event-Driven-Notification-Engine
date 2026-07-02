import {
  classifyHttpAndNetwork,
  asUnrecoverable,
  rethrowTransient,
} from './classify-error';
import { UnrecoverableError } from 'bullmq';

/**
 * Unit tests for the shared error classifier. Pure functions, no deps — just
 * feed error-shaped objects and assert transient vs permanent.
 */
describe('classifyHttpAndNetwork', () => {
  it('classifies transient network codes as transient', () => {
    expect(classifyHttpAndNetwork({ code: 'ETIMEDOUT' })).toBe('transient');
    expect(classifyHttpAndNetwork({ code: 'ECONNRESET' })).toBe('transient');
  });

  it('classifies 5xx as transient', () => {
    expect(classifyHttpAndNetwork({ statusCode: 503 })).toBe('transient');
    expect(classifyHttpAndNetwork({ status: 500 })).toBe('transient');
  });

  it('classifies 408 and 429 as transient', () => {
    expect(classifyHttpAndNetwork({ statusCode: 408 })).toBe('transient');
    expect(classifyHttpAndNetwork({ statusCode: 429 })).toBe('transient');
  });

  it('classifies 4xx (except 408/429) as permanent', () => {
    expect(classifyHttpAndNetwork({ statusCode: 400 })).toBe('permanent');
    expect(classifyHttpAndNetwork({ statusCode: 422 })).toBe('permanent');
    expect(classifyHttpAndNetwork({ status: 404 })).toBe('permanent');
  });

  it('reads status from a nested response object', () => {
    expect(classifyHttpAndNetwork({ response: { status: 422 } })).toBe(
      'permanent',
    );
  });

  it('returns unknown for unrecognized shapes', () => {
    expect(classifyHttpAndNetwork({ foo: 'bar' })).toBe('unknown');
  });

  it('treats null/undefined as transient', () => {
    expect(classifyHttpAndNetwork(null)).toBe('transient');
    expect(classifyHttpAndNetwork(undefined)).toBe('transient');
  });
});

describe('asUnrecoverable', () => {
  it('throws a BullMQ UnrecoverableError preserving the message', () => {
    expect(() => asUnrecoverable(new Error('bad token'))).toThrow(
      UnrecoverableError,
    );
    expect(() => asUnrecoverable(new Error('bad token'))).toThrow('bad token');
  });
});

describe('rethrowTransient', () => {
  it('re-throws the original error unchanged', () => {
    const err = new Error('temporary');
    expect(() => rethrowTransient(err)).toThrow(err);
  });
});
