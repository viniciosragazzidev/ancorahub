import { describe, expect, it } from "vitest";

import { aiBudgetLevel, anthropicCostUsd, budgetMonthKey, monthStartSaoPaulo, readBudgetUsd } from "./anthropic-budget-domain";

describe("AI budget", () => {
  it("prices Claude Haiku 5.5 at US$ 0.10 in / 0.50 out per million, as logged or bare", () => {
    // One conversation analysis: ~4,000 tokens in, ~1,500 out.
    expect(anthropicCostUsd("anthropic/claude-haiku-5-5", 4_000, 1_500)).toBeCloseTo(0.00115, 6);
    expect(anthropicCostUsd("claude-haiku-5-5", 1_000_000, 0)).toBeCloseTo(0.10, 6);
    expect(anthropicCostUsd("anthropic/claude-sonnet-5-5", 0, 1_000_000)).toBeCloseTo(10, 6);
    // An unknown Claude model counts at the Haiku price, never at zero.
    expect(anthropicCostUsd("anthropic/claude-new", 1_000_000, 0)).toBeCloseTo(0.10, 6);
  });

  it("warns from 80% and stops the fast pace at 100%", () => {
    expect(aiBudgetLevel(79.99, 100)).toBe("ok");
    expect(aiBudgetLevel(80, 100)).toBe("warning");
    expect(aiBudgetLevel(100, 100)).toBe("exceeded");
  });

  it("reads the saved budget, 100 when missing or invalid", () => {
    expect(readBudgetUsd("250")).toBe(250);
    expect(readBudgetUsd("150,5")).toBe(150.5);
    expect(readBudgetUsd(null)).toBe(100);
    expect(readBudgetUsd("abc")).toBe(100);
    expect(readBudgetUsd("0")).toBe(100);
  });

  it("counts the month from 00:00 of day 1 in São Paulo", () => {
    expect(monthStartSaoPaulo(new Date("2026-10-28T15:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    // 01/11 at 01:00 UTC is still 31/10 in São Paulo.
    expect(monthStartSaoPaulo(new Date("2026-11-01T01:00:00Z")).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(budgetMonthKey(new Date("2026-11-01T04:00:00Z"))).toBe("2026-11");
  });
});
