import {
  classifyHttpAndNetwork,
  asUnrecoverable,
  rethrowTransient,
} from '@common/errors/classify-error';

// Resend returns { name, message, statusCode } — pure HTTP, handled by the generic classifier.
export function throwClassifiedEmail(err: any): never {
  const cls = classifyHttpAndNetwork(err);
  if (cls === 'permanent') asUnrecoverable(err);
  rethrowTransient(err);
}
