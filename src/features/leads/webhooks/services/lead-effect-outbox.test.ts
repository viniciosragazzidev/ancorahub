import { describe, expect, it } from "vitest";

import { isLeadEligibleForEffect } from "./lead-effect-outbox";

describe("lead effect eligibility", () => {
  it("blocks missing and soft-deleted leads", () => {
    expect(isLeadEligibleForEffect(undefined)).toBe(false);
    expect(isLeadEligibleForEffect(null)).toBe(false);
    expect(isLeadEligibleForEffect({ deletedAt: new Date() })).toBe(false);
  });

  it("allows an active lead", () => {
    expect(isLeadEligibleForEffect({ deletedAt: null })).toBe(true);
  });
});
