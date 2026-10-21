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
  it("preserves complete answers, ages and yes/no responses", () => {
    const observations = "Informação comercial completa. ".repeat(20).trim();
    const items = buildLeadClientInfo({
      qualificationDetails: { individualAges: [35, 32, 8], hasCnpj: false },
      formData: { observacoes: observations, dependentes: 2 },
    });
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Idades", value: "35, 32, 8" }),
      expect.objectContaining({ label: "Tem CNPJ", value: "Não" }),
      expect.objectContaining({ label: "Observações", value: observations }),
      expect.objectContaining({ label: "Dependentes", value: "2" }),
    ]));
    expect(items.some((item) => item.key === "lives")).toBe(false);
  });

  it("keeps persisted Portuguese qualification fields visible to the broker", () => {
    const items = buildLeadClientInfo({ qualificationDetails: {
      cidade: "Cidade Exemplo", qtdVidas: "3", mediaIdades: "34",
      urgenciaContratacao: "Este mês", operadora: "Operadora Exemplo",
    } });
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Cidade", value: "Cidade Exemplo" }),
      expect.objectContaining({ label: "Vidas", value: "3" }),
      expect.objectContaining({ label: "Urgência", value: "Este mês" }),
      expect.objectContaining({ label: "Operadora de preferência", value: "Operadora Exemplo" }),
    ]));
  });

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
