import CircuitBreaker from 'opossum';

export interface BreakerOptions {
  name: string;
  timeout?: number;
  errorThresholdPercentage?: number;
  resetTimeout?: number;
}

export function makeBreaker<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  opts: BreakerOptions,
): CircuitBreaker<TArgs, TResult> {
  return new CircuitBreaker(action, {
    name: opts.name,
    timeout: opts.timeout ?? 10_000,
    errorThresholdPercentage: opts.errorThresholdPercentage ?? 50,
    resetTimeout: opts.resetTimeout ?? 30_000,

    errorFilter: (err: unknown) =>
      (err as { name?: string })?.name === 'UnrecoverableError',
  });
}
