import { describe, expect, it } from "vitest";

import { saleCatalogSelection } from "./conversation-sale-core";
import { mergeSaleCatalog } from "./sale-catalog-merge";

describe("planos da conversa da venda", () => {
  it("junta catálogo antigo e novo pela operadora, sem repetir plano", () => {
    const catalog = mergeSaleCatalog(
      [
        { carrierId: "c-amil", carrierName: "Amil", planId: "p-s380", planName: "Amil S380", planType: "familiar" },
        { carrierId: "c-sul", carrierName: "SulAmérica", planId: null, planName: null, planType: null },
      ],
      [
        { planId: "g-s380", carrierId: "g-amil", carrierName: "AMIL", planName: "Amil S380", planType: "familiar" },
        { planId: "g-s450", carrierId: "g-amil", carrierName: "AMIL", planName: "Amil S450", planType: "familiar" },
        { planId: "g-uni", carrierId: "g-unimed", carrierName: "Unimed", planName: "Unimed Rio Pleno", planType: "pme" },
      ],
    );
    expect(catalog.carriers.map((carrier) => carrier.name)).toEqual(["Amil", "SulAmérica", "Unimed"]);
    const amil = catalog.carriers[0]!;
    expect(amil).toMatchObject({ id: "c-amil", legacyId: "c-amil" });
    expect(amil.plans.map((plan) => [plan.id, plan.source])).toEqual([["p-s380", "legacy"], ["g-s450", "catalog"]]);
    expect(catalog.carriers[2]).toMatchObject({ id: "catalog:g-unimed", legacyId: null });
  });

  it("só plano do catálogo antigo liga a venda; o do catálogo novo vai para o lead", () => {
    const catalog = mergeSaleCatalog(
      [{ carrierId: "c-amil", carrierName: "Amil", planId: "p-s380", planName: "Amil S380", planType: "familiar" }],
      [{ planId: "g-uni", carrierId: "g-unimed", carrierName: "Unimed", planName: "Unimed Rio Pleno", planType: "pme" }],
    );
    expect(saleCatalogSelection(catalog, "c-amil", "p-s380")).toEqual({ carrierId: "c-amil", planId: "p-s380", leadPlanId: "p-s380", carrierName: "Amil", planName: "Amil S380" });
    expect(saleCatalogSelection(catalog, "catalog:g-unimed", "g-uni")).toEqual({ carrierId: null, planId: null, leadPlanId: "g-uni", carrierName: "Unimed", planName: "Unimed Rio Pleno" });
    expect(saleCatalogSelection(catalog, null, null)).toEqual({ carrierId: null, planId: null, leadPlanId: null, carrierName: null, planName: null });
  });
});
