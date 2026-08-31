import { describe, expect, it } from "vitest";

import { isBrokerAvailabilityTableMissing } from "./contracts";

describe("broker availability schema compatibility", () => {
  it("recognizes only the missing availability table error", () => {
    expect(isBrokerAvailabilityTableMissing({
      code: "42P01",
      query: "select * from broker_availability_windows where tenant_id = $1",
    })).toBe(true);
  });

  it("does not mask unrelated database failures", () => {
    expect(isBrokerAvailabilityTableMissing({ code: "42P01", query: "select * from leads" })).toBe(false);
    expect(isBrokerAvailabilityTableMissing({ code: "23505", query: "select * from broker_availability_windows" })).toBe(false);
  });
});
