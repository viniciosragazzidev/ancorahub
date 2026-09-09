import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { shouldCreateSyntheticCustomerConversation } from "./conversation-classification";

describe("main conversation synthetic customer classification", () => {
  const leadPhones = new Set(["5521988887777"]);
  const brokerPhones = ["+55 (21) 99999-1234"];

  it("keeps an internal broker number out of the main customer inbox", () => {
    expect(
      shouldCreateSyntheticCustomerConversation(
        { leadId: null, phone: "5521999991234" },
        leadPhones,
        brokerPhones,
      ),
    ).toBe(false);
  });

  it("keeps an unknown customer number eligible for the general WhatsApp inbox", () => {
    expect(
      shouldCreateSyntheticCustomerConversation(
        { leadId: null, phone: "5521977776666" },
        leadPhones,
        brokerPhones,
      ),
    ).toBe(true);
  });

  it("does not synthesize a conversation already linked to a lead", () => {
    expect(
      shouldCreateSyntheticCustomerConversation(
        { leadId: "lead-1", phone: "5521977776666" },
        leadPhones,
        brokerPhones,
      ),
    ).toBe(false);
  });

  it("does not synthesize a conversation already linked to a client", () => {
    expect(
      shouldCreateSyntheticCustomerConversation(
        { leadId: null, clientId: "client-1", phone: "5521977776666" },
        leadPhones,
        brokerPhones,
      ),
    ).toBe(false);
  });
});
