import {
  classifyHttpAndNetwork,
  asUnrecoverable,
  rethrowTransient,
} from '@common/errors/classify-error';

export function throwClassifiedEmail(err: unknown): never {
  const cls = classifyHttpAndNetwork(err);
  if (cls === 'permanent') asUnrecoverable(err);
  rethrowTransient(err);
}
