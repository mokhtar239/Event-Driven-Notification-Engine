import CircuitBreaker from 'opossum';

export interface BreakerOptions {
  name: string;
  timeout?: number; // ms before a call is considered failed
  errorThresholdPercentage?: number; // % failures to trip open
  resetTimeout?: number; // ms before trying half-open
}

/**
 * Wrap an async action in an opossum circuit breaker. When the downstream keeps
 * failing, the breaker opens and fast-fails instead of hammering the provider.
 *
 * Permanent errors (UnrecoverableError) are filtered out so a flood of e.g.
 * invalid-recipient errors doesn't trip the breaker — only real provider
 * outages should.
 */
export function makeBreaker<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
  opts: BreakerOptions,
): CircuitBreaker<TArgs, TResult> {
  return new CircuitBreaker(action, {
    name: opts.name,
    timeout: opts.timeout ?? 10_000,
    errorThresholdPercentage: opts.errorThresholdPercentage ?? 50,
    resetTimeout: opts.resetTimeout ?? 30_000,
    // opossum's errorFilter returns true to IGNORE the error (not count it).
    errorFilter: (err: unknown) =>
      (err as { name?: string })?.name === 'UnrecoverableError',
  });
}
