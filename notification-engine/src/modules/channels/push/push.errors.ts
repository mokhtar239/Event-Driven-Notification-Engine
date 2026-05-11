import {
  classifyHttpAndNetwork,
  asUnrecoverable,
  rethrowTransient,
} from '@common/errors/classify-error';

const PERMANENT_FIREBASE_CODES = new Set<string>([
  'messaging/invalid-argument',
  'messaging/invalid-recipient',
  'messaging/invalid-registration-token',
  'messaging/registration-token-not-registered',
  'messaging/mismatched-credential',
]);

function readProp(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

export function throwClassifiedPush(err: unknown): never {
  const fbCode =
    readProp(readProp(err, 'errorInfo'), 'code') ?? readProp(err, 'code');
  if (typeof fbCode === 'string' && PERMANENT_FIREBASE_CODES.has(fbCode)) {
    asUnrecoverable(err);
  }
  const cls = classifyHttpAndNetwork(err);
  if (cls === 'permanent') asUnrecoverable(err);
  rethrowTransient(err);
}
