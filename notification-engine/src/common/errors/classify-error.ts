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

export function classifyHttpAndNetwork(err: any): ErrorClass | 'unknown' {
  if (!err) return 'transient';

  if (typeof err.code === 'string' && TRANSIENT_NET_CODES.has(err.code)) {
    return 'transient';
  }

  const status: number | undefined =
    err.statusCode ?? err.status ?? err.response?.status;
  if (typeof status === 'number') {
    if (status === 408 || status === 429) return 'transient';
    if (status >= 500) return 'transient';
    if (PERMANENT_HTTP.has(status)) return 'permanent';
    if (status >= 400 && status < 500) return 'permanent';
  }

  return 'unknown';
}

export function asUnrecoverable(err: any): never {
  throw new UnrecoverableError(err?.message ?? 'permanent channel error');
}

export function rethrowTransient(err: any): never {
  throw err;
}
