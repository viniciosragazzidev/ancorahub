import { describe, expect, it } from "vitest";

import {
  classifyIgnoredBrokerContact,
  shouldCreateSyntheticLead,
  shouldKeepTenantChannelMessage,
  shouldPersistBrokerConnectionMessage,
  shouldStartServiceFromOutgoingLeadMessage,
} from "./inbound";

describe("outgoing lead message service start", () => {
  it("starts service for an outgoing message from the owning broker connection", () => {
    expect(shouldStartServiceFromOutgoingLeadMessage({
      isOutgoing: true,
      sourceKind: "connection",
      hasLead: true,
      brokerId: "broker-1",
    })).toBe(true);
  });

  it("does not start service for inbound messages, official number sends, or unlinked contacts", () => {
    expect(shouldStartServiceFromOutgoingLeadMessage({
      isOutgoing: false,
      sourceKind: "connection",
      hasLead: true,
      brokerId: "broker-1",
    })).toBe(false);
    expect(shouldStartServiceFromOutgoingLeadMessage({
      isOutgoing: true,
      sourceKind: "number",
      hasLead: true,
      brokerId: null,
    })).toBe(false);
    expect(shouldStartServiceFromOutgoingLeadMessage({
      isOutgoing: true,
      sourceKind: "connection",
      hasLead: false,
      brokerId: "broker-1",
    })).toBe(false);
  });
});

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

  it("does not manufacture a lead from an unknown official inbound", () => {
    expect(
      shouldCreateSyntheticLead({
        sourceKind: "number",
        isOutgoing: false,
        hasLead: false,
        hasClient: false,
        isTenantOfficialNumber: false,
      }),
    ).toBe(false);
  });
});

describe("broker WAHA workspace boundary", () => {
  it("does not persist a personal contact outside the broker CRM scope", () => {
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: false,
        hasClient: false,
      }),
    ).toBe(false);
  });

  it("keeps only a linked lead/client", () => {
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: true,
        hasClient: false,
      }),
    ).toBe(true);
    expect(
      shouldPersistBrokerConnectionMessage({
        hasLead: false,
        hasClient: true,
      }),
    ).toBe(true);
  });
});

describe("company number (WhatsApp da diretoria)", () => {
  it("keeps conversations with brokers and team", () => {
    expect(shouldKeepTenantChannelMessage({ isBrokerOrTeam: true })).toBe(true);
  });

  it("ignores anyone else — the internal channel never turns a contact into a lead", () => {
    expect(shouldKeepTenantChannelMessage({ isBrokerOrTeam: false })).toBe(false);
  });
});

describe("classifyIgnoredBrokerContact", () => {
  it("flags the broker's own number — the relay attributing an @lid reply to the broker", () => {
    expect(classifyIgnoredBrokerContact({ isOwner: true, matchingLeadOwners: [] })).toBe("proprio_corretor");
  });

  it("flags a lead whose assignment was removed mid-conversation (Neusa Galvao, 25/09)", () => {
    expect(classifyIgnoredBrokerContact({ isOwner: false, matchingLeadOwners: [null] })).toBe("lead_sem_corretor");
  });

  it("tells a lead of another broker from a contact that is not a lead", () => {
    expect(classifyIgnoredBrokerContact({ isOwner: false, matchingLeadOwners: ["other-broker"] })).toBe("lead_de_outro_corretor");
    expect(classifyIgnoredBrokerContact({ isOwner: false, matchingLeadOwners: [] })).toBe("nao_e_lead");
  });
});
