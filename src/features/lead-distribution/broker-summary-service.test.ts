import { describe, it, expect } from "vitest";
import { brokerSummaryQuerySchema } from "./broker-summary-actions";

describe("Broker Summary Query Schema Validation", () => {
  it("validates default query options", () => {
    const parsed = brokerSummaryQuerySchema.parse({});
    expect(parsed.period).toBe("today");
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.branchId).toBeNull();
  });

  it("validates custom period options", () => {
    const parsed = brokerSummaryQuerySchema.parse({
      period: "custom",
      startDate: "2026-08-01",
      endDate: "2026-08-28",
      branchId: "b-123",
    });
    expect(parsed.period).toBe("custom");
    expect(parsed.startDate).toBe("2026-08-01");
    expect(parsed.branchId).toBe("b-123");
  });
});
