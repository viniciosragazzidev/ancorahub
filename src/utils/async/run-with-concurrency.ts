export async function runWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  const limit = Math.max(1, Math.min(Math.floor(concurrency), items.length || 1));
  let cursor = 0;

  await Promise.all(Array.from({ length: limit }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index]);
    }
  }));
}
