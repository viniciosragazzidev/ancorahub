import { describe, expect, it } from "vitest";

import { incrementAiQualificationRetry } from "./retry-count";

describe("incrementAiQualificationRetry", () => {
  it("increments once for two simultaneous failed interpretations and respects the maximum", async () => {
    const state = { status: "processing", retryCount: 0 };
    let entered = 0;
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const tx = {
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              entered += 1;
              if (entered === 2) release();
              await barrier;
              if (state.status !== "processing" || state.retryCount >= 1) return [];
              state.retryCount += 1;
              state.status = "waiting_customer";
              return [{ retryCount: state.retryCount }];
            },
          }),
        }),
      }),
    };
    const attempts = await Promise.all(["a", "b"].map(() => incrementAiQualificationRetry(tx as never, {
      id: "session-1", tenantId: "tenant-1", maxRetries: 1, now: new Date(),
    })));

    expect(attempts.filter(Boolean)).toHaveLength(1);
    expect(state).toEqual({ status: "waiting_customer", retryCount: 1 });
  });
});
