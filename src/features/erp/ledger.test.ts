import { describe, expect, it } from "vitest";
import { assertOccurredByToday, assertPaymentCapacity, checkedCents, settledCents } from "./ledger";
describe("conferred financial ledger", () => {
  it("uses the business day in São Paulo rather than the next UTC date", () => {
    const now = new Date("2026-11-13T01:00:00Z");
    expect(() => assertOccurredByToday("2026-11-12", now)).not.toThrow();
    expect(() => assertOccurredByToday("2026-11-13", now)).toThrow();
  });
  it("counts only confirmed movements and preserves compensating reversals", () => {
    expect(settledCents([{ kind: "payment", status: "confirmed", amountCents: 10000 }, { kind: "payment", status: "pending", amountCents: 5000 }, { kind: "reversal", status: "confirmed", amountCents: 2500 }])).toBe(7500);
  });
  it("reserves pending confirmations without exceeding the exact amount", () => {
    expect(() => assertPaymentCapacity(10000, 2000, 3000, 5000)).not.toThrow();
    expect(() => assertPaymentCapacity(10000, 2000, 3000, 5001)).toThrow();
    expect(() => assertPaymentCapacity(10000, -1, 0, 1)).toThrow();
    expect(() => checkedCents("9007199254740992")).toThrow();
  });
});
