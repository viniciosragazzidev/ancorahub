import { describe, expect, it } from "vitest";

import { isWithinRenewalWindow, nextContractAnniversary } from "../renewal-reminders";

describe("renewal reminders", () => {
  it("calculates the next contract anniversary in the current year", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    expect(nextContractAnniversary(new Date("2024-08-01T00:00:00.000Z"), now).toISOString()).toBe("2026-08-01T00:00:00.000Z");
  });

  it("moves a passed anniversary to the next year", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    expect(nextContractAnniversary(new Date("2024-06-01T00:00:00.000Z"), now).toISOString()).toBe("2027-06-01T00:00:00.000Z");
  });

  it("alerts only inside the configured 30-day window", () => {
    const now = new Date("2026-07-14T12:00:00.000Z");
    expect(isWithinRenewalWindow(new Date("2026-08-01T00:00:00.000Z"), now)).toBe(true);
    expect(isWithinRenewalWindow(new Date("2026-08-15T00:00:00.000Z"), now)).toBe(false);
  });
});
