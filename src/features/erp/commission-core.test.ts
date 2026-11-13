import { describe, expect, it } from "vitest";
import { deterministicUuid, legacyDivergence, numericToCents, scheduleDueOn } from "./commission-core";
import { z } from "zod";

describe("commission core", () => {
  it("converts numeric text to cents without floats", () => {
    expect(numericToCents("123.45")).toBe(12345);
    expect(numericToCents("0.1")).toBe(10);
    expect(numericToCents("1000")).toBe(100000);
    expect(numericToCents("-5.00")).toBe(-500);
    expect(() => numericToCents("1,5")).toThrow();
    expect(() => numericToCents(null)).toThrow();
  });
  it("maps the same origin to the same valid uuid", () => {
    const first = deterministicUuid("schedule:t1:s1");
    expect(first).toBe(deterministicUuid("schedule:t1:s1"));
    expect(first).not.toBe(deterministicUuid("schedule:t1:s2"));
    expect(z.string().uuid().safeParse(first).success).toBe(true);
  });
  it("uses the São Paulo calendar date or the 10th of the month", () => {
    expect(scheduleDueOn(new Date("2026-03-01T02:00:00Z"), "2026-03")).toBe("2026-02-28");
    expect(scheduleDueOn(null, "2026-04")).toBe("2026-04-10");
    expect(() => scheduleDueOn(null, "2026-13")).toThrow();
  });
  it("flags divergences without inferring payment", () => {
    expect(legacyDivergence("paid", null)).toBeNull();
    expect(legacyDivergence("cancelled", { status: "approved", amountCents: 100, settledCents: 0 })).toBe("legacy_cancelled");
    expect(legacyDivergence("paid", { status: "submitted", amountCents: 100, settledCents: 0 })).toBe("legacy_paid_not_settled");
    expect(legacyDivergence("pending", { status: "approved", amountCents: 100, settledCents: 100 })).toBe("settled_legacy_pending");
    expect(legacyDivergence("pending", { status: "rejected", amountCents: 100, settledCents: 0 })).toBeNull();
    expect(legacyDivergence("paid", { status: "approved", amountCents: 100, settledCents: 100 })).toBeNull();
  });
});
