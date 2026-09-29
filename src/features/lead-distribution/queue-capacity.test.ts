import { describe, expect, it } from "vitest";

import { reserveQueueCapacitySlot } from "./queue-capacity";

function createKeyedLock() {
  const queues = new Map<string, Array<() => void>>();
  const held = new Set<string>();
  return async function withLock<T>(key: string, work: () => Promise<T>) {
    if (held.has(key)) {
      await new Promise<void>((resolve) => {
        const queue = queues.get(key) ?? [];
        queue.push(resolve);
        queues.set(key, queue);
      });
    }
    held.add(key);
    try {
      return await work();
    } finally {
      const next = queues.get(key)?.shift();
      if (next) next();
      else held.delete(key);
    }
  };
}

describe("reserveQueueCapacitySlot", () => {
  it("serializes concurrent reservations so the queue limit cannot be exceeded", async () => {
    const withLock = createKeyedLock();
    let active = 0;
    const reserve = () => reserveQueueCapacitySlot({
      capacity: 1,
      withLock: (work) => withLock("tenant-a:queue-a:broker-a", work),
      countActive: async () => active,
      reserve: async () => { active += 1; return "offer-created"; },
    });

    const results = await Promise.all([reserve(), reserve()]);

    expect(results.filter((result) => result.status === "reserved")).toHaveLength(1);
    expect(results.filter((result) => result.status === "full")).toHaveLength(1);
    expect(active).toBe(1);
  });

  it("uses separate capacity slots for the same broker in different queues", async () => {
    const withLock = createKeyedLock();
    const activeByQueue = new Map([["queue-a", 1], ["queue-b", 0]]);
    const reserve = (queueId: string) => reserveQueueCapacitySlot({
      capacity: 1,
      withLock: (work) => withLock(`tenant-a:${queueId}:broker-a`, work),
      countActive: async () => activeByQueue.get(queueId) ?? 0,
      reserve: async () => { activeByQueue.set(queueId, (activeByQueue.get(queueId) ?? 0) + 1); return queueId; },
    });

    await expect(reserve("queue-a")).resolves.toMatchObject({ status: "full" });
    await expect(reserve("queue-b")).resolves.toMatchObject({ status: "reserved", value: "queue-b" });
    expect(activeByQueue).toEqual(new Map([["queue-a", 1], ["queue-b", 1]]));
  });
});
