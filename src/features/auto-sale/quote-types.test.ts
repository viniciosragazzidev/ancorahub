import { describe, expect, it } from "vitest";

import type { CatalogPlan } from "@/features/global-catalog/pilot/contracts";
import { simulate } from "@/features/global-catalog/pilot/engine";

import { entityFacets, resolveEntity } from "./entity-match";
import { businessProfileFromText, catalogModality, mergeFacts, missingForQuote, quoteInputFromFacts } from "./facts";
import { allowedForMode, isReadyExceptDocuments } from "./offer-strategy";
import { entityQuestion } from "./turn-engine";

function catalogPlan(overrides: Partial<CatalogPlan>): CatalogPlan {
  return {
    id: "p1", name: "Plano", code: "P1", operator: "Op", operatorId: "op", administrator: "", modality: "PESSOA_FISICA",
    accommodation: "Enfermaria", coparticipation: "Sem coparticipação", coverage: "", entity: "", cities: ["Niterói"], businessProfiles: [],
    dental: null, minAge: null, maxAge: null, holderMin: null, holderMax: null, dependentMin: null, dependentMax: null, minLives: null,
    maxLives: null, minHolders: null, ageConfirmed: true, eligibilityConfirmed: true, businessConfirmed: true, from: null, to: null,
    prices: [{ id: "pr", cents: 30000, min: 0, max: null, active: true, from: null, to: null, priority: 1, lives: null }], networkCount: 0, detailCount: 0,
    ...overrides,
  };
}

describe("fatos por tipo de cotação", () => {
  it("adesão pede a entidade; PME pede tipo e tempo de CNPJ", () => {
    const base = { ages: [35], city: "Niterói" };
    expect(missingForQuote({ ...base, modality: "ADESAO" })).toEqual(["entity"]);
    expect(missingForQuote({ ...base, modality: "PME_EMPRESARIAL" })).toEqual(["businessProfile", "businessMonths"]);
    expect(missingForQuote({ ...base, modality: "PME_EMPRESARIAL", businessProfile: "MEI", businessMonths: 8 })).toEqual([]);
  });

  it("tipo de empresa dito pelo cliente vira o código do catálogo", () => {
    expect(businessProfileFromText("sou MEI")).toBeUndefined();
    expect(businessProfileFromText("MEI")).toBe("MEI");
    expect(businessProfileFromText("microempresa")).toBe("ME");
    expect(businessProfileFromText("Ltda.")).toBe("LTDA");
    expect(businessProfileFromText("S.A.")).toBe("S_A");
    expect(mergeFacts({}, { businessProfile: "limitada" }).businessProfile).toBe("LTDA");
  });

  it("odonto usa as modalidades *_ODONTO; saúde com odonto filtra planos com odonto", () => {
    expect(catalogModality({ modality: "ADESAO", product: "odonto" })).toBe("ADESAO_ODONTO");
    expect(catalogModality({ modality: "PESSOA_FISICA" })).toBe("PESSOA_FISICA");
    const input = quoteInputFromFacts({ ages: [35, 8], city: "Niterói", modality: "PME_EMPRESARIAL", businessProfile: "ME", businessMonths: 12, dentalIncluded: true });
    expect(input).toMatchObject({ modality: "PME_EMPRESARIAL", businessProfile: "ME", businessMonths: 12, dental: "yes" });
  });
});

describe("entidade de adesão", () => {
  const facets = entityFacets([
    catalogPlan({ modality: "ADESAO", entity: "OAB/RJ - Ordem dos Advogados" }),
    catalogPlan({ modality: "ADESAO", entity: "CREA-RJ" }),
    catalogPlan({ modality: "ADESAO", entity: "CRM-RJ" }),
    catalogPlan({ modality: "ADESAO", entity: "CRO-RJ" }),
    catalogPlan({ modality: "PESSOA_FISICA", entity: "Não é adesão" }),
  ], "ADESAO");

  it("pela sigla, pela profissão ou pergunta quando bate com várias", () => {
    expect(facets.map((facet) => facet.value)).not.toContain("Não é adesão");
    expect(resolveEntity("OAB", facets)).toEqual({ entity: "OAB/RJ - Ordem dos Advogados" });
    expect(resolveEntity("sou advogado", facets, [{ label: "Advogado", value: "OAB" }])).toEqual({ entity: "OAB/RJ - Ordem dos Advogados" });
    expect(resolveEntity("CR", facets)).toEqual({ options: ["CREA-RJ", "CRM-RJ", "CRO-RJ"] });
    expect(resolveEntity("astronauta", facets)).toEqual({ unknown: true });
    expect(entityQuestion(["CREA-RJ", "CRM-RJ"])).toBe("Por qual entidade seria: CREA-RJ ou CRM-RJ?");
  });
});

describe("pendência: bloqueante x conferência de documento", () => {
  const date = "2026-11-12";
  const run = (plan: CatalogPlan, input: Parameters<typeof simulate>[1], reviewed = true) =>
    simulate([plan], input, date, new Set(reviewed ? [plan.id] : []), new Set(), "cotadorfm-2026-11-11-abcdefabcdef").results[0];
  const family = quoteInputFromFacts({ ages: [35, 33, 6], city: "Niterói", modality: "ADESAO", entity: "OAB" })!;

  it("adesão com família, plano revisado e confirmado: só conferência de documento, o Autopiloto cota", () => {
    const result = run(catalogPlan({ modality: "ADESAO", entity: "OAB/RJ" }), family);
    expect(result.state).toBe("pending");
    expect(isReadyExceptDocuments(result)).toBe(true);
    expect(allowedForMode(result, "autopilot")).toBe(true);
  });

  it("PME com perfil e tempo informados: só conferência de documento", () => {
    const input = quoteInputFromFacts({ ages: [40, 38], city: "Niterói", modality: "PME_EMPRESARIAL", businessProfile: "MEI", businessMonths: 12 })!;
    const result = run(catalogPlan({ modality: "PME_EMPRESARIAL", businessProfiles: ["MEI"] }), input);
    expect(isReadyExceptDocuments(result)).toBe(true);
  });

  it("plano não revisado ou critério sem confirmação na fonte continua bloqueando o Autopiloto", () => {
    expect(isReadyExceptDocuments(run(catalogPlan({ modality: "ADESAO", entity: "OAB/RJ" }), family, false))).toBe(false);
    const unconfirmed = run(catalogPlan({ modality: "ADESAO", entity: "OAB/RJ", eligibilityConfirmed: false }), family);
    expect(allowedForMode(unconfirmed, "autopilot")).toBe(false);
    expect(allowedForMode(unconfirmed, "copilot")).toBe(true);
  });
});
