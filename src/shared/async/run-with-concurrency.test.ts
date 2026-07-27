import { describe, expect, it } from "vitest";

import { runWithConcurrency } from "./run-with-concurrency";

describe("notification delivery concurrency", () => {
  it.each(["push", "WhatsApp"])(
    "processes every %s delivery once while respecting the concurrency ceiling",
    async () => {
      const items = Array.from({ length: 40 }, (_, index) => index);
      const processed: number[] = [];
      let active = 0;
      let peak = 0;

      await runWithConcurrency(items, 5, async (item) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 2));
        processed.push(item);
        active -= 1;
      });

      expect(peak).toBeLessThanOrEqual(5);
      expect(processed).toHaveLength(items.length);
      expect(new Set(processed).size).toBe(items.length);
    },
  );

  it("does not fail when the queue is empty", async () => {
    await expect(runWithConcurrency([], 5, async () => undefined)).resolves.toBeUndefined();
  });
});
