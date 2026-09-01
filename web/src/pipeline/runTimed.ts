/**
 * Runs a real pipeline step and captures its actual elapsed time,
 * result, and error — the same shape every stage's "not-started ->
 * passed/failed" status line and detail panel are built from.
 */
export interface TimedResult<T> {
  value: T | null;
  error: string | null;
  durationMs: number;
}

export function runTimed<T>(fn: () => T): TimedResult<T> {
  const start = performance.now();
  try {
    const value = fn();
    return { value, error: null, durationMs: performance.now() - start };
  } catch (err) {
    return {
      value: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
  }
}
