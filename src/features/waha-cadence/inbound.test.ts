import { describe, expect, it } from "vitest";

import {
  shouldCreateSyntheticLead,
  shouldPersistBrokerConnectionMessage,
} from "./inbound";

describe("shouldCreateSyntheticLead", () => {
  it("creates a tenant lead from an inbound to a broker connection when none exists", () => {
    expect(
      shouldCreateSyntheticLead({
        sourceKind: "connection",
        isOutgoing: false,
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(true);
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
  it("persists inbound broker messages", () => {
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(true);
  });

  it("keeps a linked lead/client or the tenant official number", () => {
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
