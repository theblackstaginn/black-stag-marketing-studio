/** Bound each upstream request, including response-body reads. Never retry here. */
export function createDeadlineFetch({ fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120000) {
    throw new RangeError('timeoutMs must be between 1 and 120000');
  }
  return (input, init = {}) => {
    const signals = [AbortSignal.timeout(timeoutMs)];
    if (typeof Request !== 'undefined' && input instanceof Request) signals.push(input.signal);
    if (init.signal) signals.push(init.signal);
    return fetchImpl(input, { ...init, signal: AbortSignal.any(signals) });
  };
}
