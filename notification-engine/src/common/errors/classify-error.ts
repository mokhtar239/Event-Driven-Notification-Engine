import { UnrecoverableError } from 'bullmq';

export type ErrorClass = 'transient' | 'permanent';

const PERMANENT_HTTP = new Set([400, 401, 403, 404, 410, 422]);

const TRANSIENT_NET_CODES = new Set([
  'ETIMEDOUT',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
]);

function readProp(obj: unknown, key: string): unknown {
  if (obj && typeof obj === 'object' && key in obj) {
    return (obj as Record<string, unknown>)[key];
  }
  return undefined;
}

export function classifyHttpAndNetwork(err: unknown): ErrorClass | 'unknown' {
  if (!err) return 'transient';

  const code = readProp(err, 'code');
  if (typeof code === 'string' && TRANSIENT_NET_CODES.has(code)) {
    return 'transient';
  }

  const status =
    readProp(err, 'statusCode') ??
    readProp(err, 'status') ??
    readProp(readProp(err, 'response'), 'status');

  if (typeof status === 'number') {
    if (status === 408 || status === 429) return 'transient';
    if (status >= 500) return 'transient';
    if (PERMANENT_HTTP.has(status)) return 'permanent';
    if (status >= 400 && status < 500) return 'permanent';
  }

  return 'unknown';
}

export function asUnrecoverable(err: unknown): never {
  const message = readProp(err, 'message');
  throw new UnrecoverableError(
    typeof message === 'string' ? message : 'permanent channel error',
  );
}

export function rethrowTransient(err: unknown): never {
  throw err;
}
