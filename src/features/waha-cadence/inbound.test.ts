import { describe, expect, it } from "vitest";

import { shouldCreateSyntheticLead } from "./inbound";

describe("shouldCreateSyntheticLead", () => {
  it("never creates a tenant lead from an unknown inbound to a broker connection", () => {
    expect(
      shouldCreateSyntheticLead({
        sourceKind: "connection",
        isOutgoing: false,
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(false);
  });

  it("keeps tenant relay intake for unknown external inbound", () => {
    expect(
      shouldCreateSyntheticLead({
        sourceKind: "number",
        isOutgoing: false,
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(true);
  });
});
