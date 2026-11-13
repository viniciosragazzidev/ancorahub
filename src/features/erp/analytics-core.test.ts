import { describe, expect, it } from "vitest";
import { dayKey, daysOfMonth, decimalToCents, fillBuckets, formatBasisPoints, isPartialMonth, monthKey, monthRange, shareBasisPoints, shiftMonth, sumCents, yoyBasisPoints } from "./analytics-core";

describe("analytics calendar (America/Sao_Paulo)", () => {
  it("buckets an instant by the São Paulo month and day, not UTC", () => {
    const lateNight = new Date("2026-12-01T02:30:00Z"); // 30/11 23:30 em São Paulo
    expect(monthKey(lateNight)).toBe("2026-11");
    expect(dayKey(lateNight)).toBe("2026-11-30");
    expect(monthKey(new Date("2026-12-01T03:00:00Z"))).toBe("2026-12");
  });
  it("shifts months across years and lists inclusive ranges", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 13)).toBe("2027-01");
    expect(monthRange("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(() => monthRange("2026-03", "2026-01")).toThrow("anterior");
    expect(() => monthRange("2020-01", "2026-01")).toThrow("máximo");
    expect(() => monthRange("2026-13", "2026-12")).toThrow();
  });
  it("lists every day of the month without assuming 30 days", () => {
    expect(daysOfMonth("2028-02")).toHaveLength(29);
    expect(daysOfMonth("2026-02")).toHaveLength(28);
    expect(daysOfMonth("2026-01").at(-1)).toBe("2026-01-31");
  });
  it("flags the current month as partial", () => {
    const now = new Date("2026-11-12T15:00:00Z");
    expect(isPartialMonth("2026-11", now)).toBe(true);
    expect(isPartialMonth("2026-10", now)).toBe(false);
  });
});

describe("analytics arithmetic", () => {
  it("returns no YoY when the base is zero or missing", () => {
    expect(yoyBasisPoints(5, 0)).toBeNull();
    expect(yoyBasisPoints(5, null)).toBeNull();
    expect(yoyBasisPoints(null, 5)).toBeNull();
    expect(yoyBasisPoints(15, 10)).toBe(5000);
    expect(yoyBasisPoints(5, 10)).toBe(-5000);
    expect(formatBasisPoints(null)).toBe("—");
    expect(formatBasisPoints(5000, true)).toBe("+50,0%");
  });
  it("computes shares without dividing by zero", () => {
    expect(shareBasisPoints(1, 3)).toBe(3333);
    expect(shareBasisPoints(0, 0)).toBeNull();
  });
  it("sums cents exactly with BigInt and refuses unsafe totals", () => {
    expect(sumCents(["9007199254740000", 991])).toBe(9007199254740991);
    expect(() => sumCents(["9007199254740991", 1])).toThrow("limite");
    expect(() => sumCents(["1.5"])).toThrow();
  });
  it("converts Postgres numeric text to cents without floating point", () => {
    expect(decimalToCents("150.10")).toBe(15010);
    expect(decimalToCents("0.1")).toBe(10);
    expect(decimalToCents("12")).toBe(1200);
    expect(decimalToCents(null)).toBeNull();
    expect(decimalToCents("abc")).toBeNull();
  });
  it("fills missing buckets with zero in order", () => {
    expect(fillBuckets(["a", "b"], [{ key: "b", count: 2 }], { count: 0 })).toEqual([{ key: "a", count: 0 }, { key: "b", count: 2 }]);
  });
});
