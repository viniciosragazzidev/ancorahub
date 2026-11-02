import { describe, expect, it } from "vitest";
import { visibleRefreshDelay } from "./use-visible-realtime-refresh";

const timing = { coalesceMs: 3_000, maxWaitMs: 10_000, minGapMs: 15_000 };

describe("visibleRefreshDelay", () => {
  it("waits the coalesce window after a first signal long after the last refresh", () => {
    expect(visibleRefreshDelay(timing, 100_000, 0, 100_000)).toBe(3_000);
  });

  it("never waits past maxWait from the first signal of a steady stream", () => {
    expect(visibleRefreshDelay(timing, 100_000, 0, 108_000)).toBe(2_000);
    expect(visibleRefreshDelay(timing, 100_000, 0, 112_000)).toBe(0);
  });

  it("keeps two refreshes at least minGap apart", () => {
    expect(visibleRefreshDelay(timing, 101_000, 100_000, 101_000)).toBe(14_000);
  });
});
