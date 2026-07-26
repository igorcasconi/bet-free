// Default cap for fan-out against external APIs / DB connection pools —
// conservative enough for the TheSportsDB free tier's rate limit.
export const DEFAULT_CONCURRENCY_LIMIT = 3;

// Worker-pool with a fixed number of concurrent workers pulling from a
// shared queue, instead of unbounded Promise.all — protects rate-limited
// external APIs (free tier) and connection-pooled DB writes from bursts.
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      results[current] = await fn(items[current]);
    }
  }

  const workerCount = Math.max(1, Math.min(limit, items.length));
  await Promise.all(Array.from({ length: workerCount }, worker));

  return results;
}
