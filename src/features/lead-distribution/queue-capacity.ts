export async function reserveQueueCapacitySlot<T>(input: {
  capacity: number | null;
  withLock: <Result>(work: () => Promise<Result>) => Promise<Result>;
  countActive: () => Promise<number>;
  reserve: () => Promise<T>;
}): Promise<{ status: "full" } | { status: "reserved"; value: T }> {
  return input.withLock(async () => {
    if (input.capacity !== null && await input.countActive() >= input.capacity) {
      return { status: "full" } as const;
    }
    return { status: "reserved", value: await input.reserve() } as const;
  });
}
