import { describe, expect, it } from "vitest";

import { stripLeadOriginForBroker, stripLeadOriginForRole } from "./broker-visibility";

const lead = {
  id: "lead-1",
  nome: "Maria",
  origem: "webhook",
  sourceChannel: "meta_lead_ads",
  sourceCampaign: "Campanha PME Outubro",
  sourceMetadata: { entry: "whatsapp", adsLabel: "Anúncio 1" },
  metaCampaignId: "123",
  createdAt: "2026-10-01T10:00:00.000Z",
  assignedAt: "2026-10-16T09:00:00.000Z",
};

describe("stripLeadOriginForBroker", () => {
  it("removes origin, campaign and channel details", () => {
    const result = stripLeadOriginForBroker(lead);
    expect(result.origem).toBe("");
    expect(result.sourceChannel).toBeNull();
    expect(result.sourceCampaign).toBeNull();
    expect(result.metaCampaignId).toBeNull();
    expect(result.sourceMetadata).toEqual({
      tipoPlano: null,
      tipoPlanoStatus: null,
      tipoCnpj: null,
      operadora: null,
      entry: null,
      adsLabel: null,
    });
  });

  it("replaces the creation date with the assignment time and keeps the assignment", () => {
    const result = stripLeadOriginForBroker(lead);
    expect(result.createdAt).toBe(lead.assignedAt);
    expect(result.assignedAt).toBe(lead.assignedAt);
  });

  it("keeps the creation date when the lead was never assigned", () => {
    const result = stripLeadOriginForBroker({ ...lead, assignedAt: null });
    expect(result.createdAt).toBe(lead.createdAt);
  });

  it("strips the queue's `source` field and leaves other fields alone", () => {
    const result = stripLeadOriginForBroker({ id: "q1", name: "Joao", source: "webhook" });
    expect(result).toEqual({ id: "q1", name: "Joao", source: "" });
  });

  it("does not change the original object", () => {
    stripLeadOriginForBroker(lead);
    expect(lead.origem).toBe("webhook");
    expect(lead.createdAt).toBe("2026-10-01T10:00:00.000Z");
  });
});

describe("stripLeadOriginForRole", () => {
  it("strips only for brokers", () => {
    expect(stripLeadOriginForRole("broker", [lead])[0]?.origem).toBe("");
    expect(stripLeadOriginForRole("manager", [lead])[0]?.origem).toBe("webhook");
    expect(stripLeadOriginForRole("director", [lead])[0]?.createdAt).toBe(lead.createdAt);
    expect(stripLeadOriginForRole(undefined, [lead])[0]?.origem).toBe("webhook");
  });
});
