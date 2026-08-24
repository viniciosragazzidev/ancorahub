import { describe, expect, it } from "vitest";

import {
  shouldCreateSyntheticLead,
  shouldPersistBrokerConnectionMessage,
} from "./inbound";

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

describe("broker WAHA workspace boundary", () => {
  it("does not persist a personal contact outside the broker CRM scope", () => {
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(false);
  });

  it("keeps only a linked lead/client or the tenant official number", () => {
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: true,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(true);
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: true,
      }),
    ).toBe(true);
  });
});
