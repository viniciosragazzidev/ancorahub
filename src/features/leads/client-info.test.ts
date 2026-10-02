import { describe, expect, it } from "vitest";

import { buildLeadClientInfo, buildLeadOfferSummary } from "./client-info";

const qualified = {
  email: "toni@example.test",
  tipo: "PF",
  sourceChannel: "meta_lead_ads",
  sourceMetadata: { tipoPlano: null, tipoCnpj: null, operadora: null, formAnswers: ["Você tem empresa?: Não"] },
  qualificationDetails: {
    city: "Rio de janeiro",
    planType: "familiar",
    numberOfLives: "3",
    individualAges: "28, 26, 3",
    aiQualificationContext: { memory: { intent: { value: "cotação Smart Sênior" }, customerName: { value: "Toni" } } },
  },
};

describe("buildLeadClientInfo", () => {
  it("brings what the client said to the AI and filled in the form", () => {
    expect(buildLeadClientInfo(qualified).map((item) => `${item.label}: ${item.value}`)).toEqual([
      "Tipo de plano: Familiar",
      "Vidas: 3",
      "Idades: 28, 26, 3",
      "Cidade: Rio de janeiro",
      "E-mail: toni@example.test",
      "Interesse: cotação Smart Sênior",
      "Você tem empresa?: Não",
    ]);
  });

  it("reads the Meta form when the AI did not qualify", () => {
    expect(buildLeadClientInfo({ sourceChannel: "meta_lead_ads", sourceMetadata: { tipoPlano: "PME", tipoCnpj: "MEI", operadora: "Amil" } }).map((item) => item.label))
      .toEqual(["Tipo de plano", "Tipo de CNPJ", "Operadora de preferência"]);
  });
});

describe("buildLeadOfferSummary", () => {
  it("is one short line for the offer template", () => {
    expect(buildLeadOfferSummary(qualified, "Plano de saúde")).toBe("Familiar · 3 vidas · idades 28, 26, 3 · Rio de janeiro · interesse: cotação Smart Sênior");
  });

  it("falls back to the product when nothing was told", () => {
    expect(buildLeadOfferSummary({}, "Plano Individual")).toBe("Plano Individual");
  });
});
