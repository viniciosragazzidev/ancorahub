import { describe, expect, it } from "vitest";

import { backgroundRoute, isInBackgroundPool, runInBackgroundPool } from "./background-pool";

describe("background pool scope", () => {
  it("is on inside the scope, across awaits, and off outside", async () => {
    expect(isInBackgroundPool()).toBe(false);
    const seen = await runInBackgroundPool(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return isInBackgroundPool();
    });
    expect(seen).toBe(true);
    expect(isInBackgroundPool()).toBe(false);
  });

  it("wraps a route handler and keeps its arguments and result", async () => {
    const handler = backgroundRoute(async (value: number) => ({ value, background: isInBackgroundPool() }));
    await expect(handler(7)).resolves.toEqual({ value: 7, background: true });
  });
});
