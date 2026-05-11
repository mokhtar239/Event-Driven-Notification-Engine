import {
  classifyHttpAndNetwork,
  asUnrecoverable,
  rethrowTransient,
} from '@common/errors/classify-error';

const PERMANENT_TWILIO_CODES = new Set<number>([
  21211, // invalid 'To' number
  21214, // 'To' unreachable
  21408, // SMS not enabled for region
  21610, // recipient unsubscribed
  21614, // not a valid mobile number
]);

function readProp(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

export function throwClassifiedSms(err: unknown): never {
  const code = readProp(err, 'code');
  if (typeof code === 'number' && PERMANENT_TWILIO_CODES.has(code)) {
    asUnrecoverable(err);
  }
  const cls = classifyHttpAndNetwork(err);
  if (cls === 'permanent') asUnrecoverable(err);
  rethrowTransient(err);
}
