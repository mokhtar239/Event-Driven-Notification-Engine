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

export function throwClassifiedPush(err: any): never {
  const fbCode: string | undefined = err?.errorInfo?.code ?? err?.code;
  if (typeof fbCode === 'string' && PERMANENT_FIREBASE_CODES.has(fbCode)) {
    asUnrecoverable(err);
  }
  const cls = classifyHttpAndNetwork(err);
  if (cls === 'permanent') asUnrecoverable(err);
  rethrowTransient(err);
}
