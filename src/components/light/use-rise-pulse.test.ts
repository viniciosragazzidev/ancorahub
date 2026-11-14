// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { nextRisePulse, useRisePulse } from "./use-rise-pulse";

describe("nextRisePulse", () => {
  it("pulses only when the number goes up", () => {
    expect(nextRisePulse(2, 3, 0)).toBe(1);
    expect(nextRisePulse(3, 2, 1)).toBe(1);
    expect(nextRisePulse(3, 3, 1)).toBe(1);
    expect(nextRisePulse(0, 5, 4)).toBe(5);
  });
});

describe("useRisePulse", () => {
  it("does not pulse on the first paint", () => {
    const { result } = renderHook(({ count }) => useRisePulse(count), { initialProps: { count: 4 } });
    expect(result.current).toBeUndefined();
  });

  it("gives a new key when the count rises and keeps it when it falls or repeats", () => {
    const { result, rerender } = renderHook(({ count }) => useRisePulse(count), { initialProps: { count: 1 } });
    rerender({ count: 2 });
    expect(result.current).toBe(1);
    rerender({ count: 2 });
    expect(result.current).toBe(1);
    rerender({ count: 0 });
    expect(result.current).toBe(1);
    rerender({ count: 3 });
    expect(result.current).toBe(2);
  });
});
