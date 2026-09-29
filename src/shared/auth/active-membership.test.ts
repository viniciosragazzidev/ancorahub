import { describe, expect, it } from "vitest";

import { selectSingleActiveMembership } from "./active-membership";

describe("selectSingleActiveMembership", () => {
  it("ignores an inactive legacy association when one active association remains", () => {
    const selected = selectSingleActiveMembership([
      { id: "legacy-broker", membershipStatus: "inactive" },
      { id: "current-manager", membershipStatus: "active" },
    ]);

    expect(selected.id).toBe("current-manager");
  });

  it("denies ambiguous identities with more than one active association", () => {
    expect(() => selectSingleActiveMembership([
      { id: "tenant-a", membershipStatus: "active" },
      { id: "tenant-b", membershipStatus: "active" },
    ])).toThrow(/exactly one active tenant membership/i);
  });

  it("denies identities without an active association", () => {
    expect(() => selectSingleActiveMembership([
      { id: "tenant-a", membershipStatus: "inactive" },
    ])).toThrow(/exactly one active tenant membership/i);
  });
});
