import { describe, it, expect } from "vitest";
import { fetchBrokerDailySummary } from "./broker-summary-service";

describe("Broker Daily Summary Service", () => {
  it("exports fetchBrokerDailySummary function", () => {
    expect(typeof fetchBrokerDailySummary).toBe("function");
  });
});
