import { describe, expect, it } from "vitest";

import { planFactChanges, quoteFactKey, sameValue, summarizeActions } from "./diff";
import { expandPriceTables, extractionSchema, mergeExtractions, plausibleValidUntil, splitIntoWindows } from "./extraction";
import { matchCarrier, matchPlan } from "./matching";
import { ageBandsInQuestion, agesInQuestion, carriersInQuestion, plansInQuestion } from "./question-scope";
import { buildFactKey, canonicalQualifiers, mergeAreas, normalizeAgeBand, parseNumericValue, SYSTEM_AREAS } from "./taxonomy";

describe("taxonomy", () => {
  it("normalizes ANS age bands written in different ways", () => {
    expect(normalizeAgeBand("00 a 18")).toBe("0-18");
    expect(normalizeAgeBand("19 - 23 anos")).toBe("19-23");
    expect(normalizeAgeBand("59 ou mais")).toBe("59+");
    expect(normalizeAgeBand("acima de 59")).toBe("59+");
    expect(normalizeAgeBand("59+")).toBe("59+");
  });

  it("reads numbers in Brazilian format", () => {
    expect(parseNumericValue("R$ 1.234,56")).toBe(1234.56);
    expect(parseNumericValue("12,5%")).toBe(12.5);
    expect(parseNumericValue("180 dias")).toBe(180);
    expect(parseNumericValue("R$ 1.200")).toBe(1200);
    expect(parseNumericValue("Apartamento")).toBeNull();
  });

  it("gives the same fact key to the same information written differently", () => {
    const a = buildFactKey({ carrierId: "c1", planId: "p1", areaSlug: "precos", fieldKey: "mensalidade", qualifiers: canonicalQualifiers({ faixa_etaria: "00 a 18", Acomodação: "Apartamento" }) });
    const b = buildFactKey({ carrierId: "c1", planId: "p1", areaSlug: "precos", fieldKey: "mensalidade", qualifiers: canonicalQualifiers({ acomodacao: "apartamento", faixa_etaria: "0-18" }) });
    expect(a).toBe(b);
  });

  it("keeps each network provider as its own fact", () => {
    const base = { carrierId: "c1", planId: "p1", areaSlug: "rede_credenciada", fieldKey: "hospital", qualifiers: {} };
    expect(buildFactKey({ ...base, value: "Hospital Copa D'Or" })).not.toBe(buildFactKey({ ...base, value: "Hospital Quinta D'Or" }));
  });

  it("adds approved custom areas and fields to the system ones", () => {
    const areas = mergeAreas([
      { slug: "planos", label: "Planos", description: null, fields: [{ key: "reembolso", label: "Reembolso", type: "money" }] },
      { slug: "telemedicina", label: "Telemedicina", description: "Atendimento online", fields: [] },
    ]);
    expect(areas.find((area) => area.slug === "planos")?.fields.some((field) => field.key === "reembolso")).toBe(true);
    expect(areas.find((area) => area.slug === "telemedicina")?.custom).toBe(true);
    expect(areas.length).toBe(SYSTEM_AREAS.length + 1);
  });
});

describe("extraction", () => {
  it("drops a malformed fact instead of the whole answer", () => {
    const parsed = extractionSchema.parse({
      documentType: "tabela_precos",
      carrier: { name: "Amil" },
      plans: [{ name: "S380" }],
      facts: [{ area: "carencias", field: "parto", value: "300 dias" }, { area: "", value: 1 }],
      priceTables: [{ plan: "S380", qualifiers: { acomodacao: "enfermaria" }, bands: [{ band: "0-18", value: 210.5 }] }],
    });
    expect(parsed.facts).toHaveLength(1);
    expect(parsed.priceTables).toHaveLength(1);
    expect(parsed.suggestions).toEqual([]);
  });

  it("falls back to 'outro' on an unknown document type", () => {
    expect(extractionSchema.parse({ documentType: "planilha" }).documentType).toBe("outro");
  });

  it("turns a price table into one fact per age band", () => {
    const facts = expandPriceTables([{ plan: "S380", qualifiers: { acomodacao: "enfermaria" }, bands: [{ band: "0-18", value: "210,50" }, { band: "59+", value: "1.300,00" }], page: 2 }]);
    expect(facts).toHaveLength(2);
    expect(facts[1]).toMatchObject({ area: "precos", field: "mensalidade", value: "1.300,00", qualifiers: { acomodacao: "enfermaria", faixa_etaria: "59+" }, page: 2 });
  });

  it("merges windows, keeping the first header and one copy of each fact", () => {
    const one = extractionSchema.parse({ documentType: "manual_regras", title: "Manual PME", carrier: { name: "Amil" }, plans: [{ name: "S380" }], facts: [{ plan: "S380", area: "carencias", field: "parto", value: "300 dias" }] });
    const two = extractionSchema.parse({ documentType: "outro", carrier: null, plans: [{ name: "S380", aliases: ["Amil S 380"] }, { name: "S450" }], facts: [{ plan: "S380", area: "carencias", field: "parto", value: "300 dias" }] });
    const merged = mergeExtractions([one, two]);
    expect(merged.documentType).toBe("manual_regras");
    expect(merged.carrier?.name).toBe("Amil");
    expect(merged.plans.map((plan) => plan.name)).toEqual(["S380", "S450"]);
    expect(merged.plans[0]?.aliases).toEqual(["Amil S 380"]);
    expect(merged.facts).toHaveLength(1);
  });

  it("splits long text into windows without cutting a line", () => {
    const line = "Faixa 0-18 | R$ 210,50";
    const windows = splitIntoWindows(Array.from({ length: 100 }, () => line).join("\n"), 500);
    expect(windows.length).toBeGreaterThan(1);
    expect(windows.every((window) => window.split("\n").every((row) => row === line))).toBe(true);
  });
});

describe("matching", () => {
  const carriers = [{ id: "amil", name: "Amil", aliases: ["Amil Assistência Médica Internacional"] }, { id: "assim", name: "Assim Saúde" }];

  it("finds the operator by name, alias or prefix", () => {
    expect(matchCarrier("AMIL", carriers)?.id).toBe("amil");
    expect(matchCarrier("Amil Assistencia Medica Internacional S.A.", carriers)?.id).toBe("amil");
    expect(matchCarrier("Assim", carriers)?.id).toBe("assim");
    expect(matchCarrier("Bradesco Saúde", carriers)).toBeNull();
  });

  it("finds the plan with or without the operator name in front", () => {
    const plans = [{ id: "s380", name: "S380 QC", code: null }, { id: "s450", name: "Amil S450" }];
    expect(matchPlan("Amil S 380 QC", plans, "Amil")?.id).toBe("s380");
    expect(matchPlan("S450", plans, "Amil")?.id).toBe("s450");
    expect(matchPlan("S750", plans, "Amil")).toBeNull();
  });
});

describe("planFactChanges", () => {
  const fact = (factKey: string, valueText: string, areaSlug = "carencias") => ({ factKey, areaSlug, valueText, valueNumber: parseNumericValue(valueText) });
  const reviewPrices = (area: string) => area === "precos";

  it("only touches what did not change", () => {
    const actions = planFactChanges({
      incoming: [fact("k1", "300 dias")],
      stored: [{ id: "s1", factKey: "k1", valueText: "300 dias", valueNumber: 300, status: "current" }],
      origin: "material",
      reviewRequired: reviewPrices,
    });
    expect(actions).toEqual([{ kind: "touch", fact: fact("k1", "300 dias"), storedId: "s1" }]);
  });

  it("replaces a changed rule right away and keeps the old one as superseded", () => {
    const [action] = planFactChanges({
      incoming: [fact("k1", "180 dias")],
      stored: [{ id: "s1", factKey: "k1", valueText: "300 dias", valueNumber: 300, status: "current" }],
      origin: "material",
      reviewRequired: reviewPrices,
    });
    expect(action).toMatchObject({ kind: "insert_current", supersedesId: "s1" });
  });

  it("holds a changed price for review and keeps the current one live", () => {
    const [action] = planFactChanges({
      incoming: [fact("p1", "R$ 250,00", "precos")],
      stored: [{ id: "s1", factKey: "p1", valueText: "R$ 230,00", valueNumber: 230, status: "current" }],
      origin: "material",
      reviewRequired: reviewPrices,
    });
    expect(action).toMatchObject({ kind: "insert_pending", replacesId: "s1", dropsPendingId: null });
  });

  it("replaces an older pending price with the newest one", () => {
    const [action] = planFactChanges({
      incoming: [fact("p1", "R$ 260,00", "precos")],
      stored: [{ id: "pend", factKey: "p1", valueText: "R$ 250,00", valueNumber: 250, status: "pending_review" }],
      origin: "material",
      reviewRequired: reviewPrices,
    });
    expect(action).toMatchObject({ kind: "insert_pending", replacesId: null, dropsPendingId: "pend" });
  });

  it("keeps quote prices as observations that point at a different table price", () => {
    const [action] = planFactChanges({
      incoming: [fact("p1", "R$ 240,00", "precos")],
      stored: [{ id: "table", factKey: "p1", valueText: "R$ 230,00", valueNumber: 230, status: "current" }],
      origin: "quote",
      reviewRequired: reviewPrices,
    });
    expect(action).toMatchObject({ kind: "insert_current", supersedesId: null, divergesFromId: "table" });
    expect(action?.fact.factKey).toBe(quoteFactKey("p1"));
  });

  it("summarizes the changes of a material", () => {
    const actions = planFactChanges({
      incoming: [fact("a", "1"), fact("b", "2"), fact("p", "R$ 10,00", "precos")],
      stored: [{ id: "sa", factKey: "a", valueText: "1", valueNumber: 1, status: "current" }, { id: "sb", factKey: "b", valueText: "3", valueNumber: 3, status: "current" }],
      origin: "material",
      reviewRequired: reviewPrices,
    });
    expect(summarizeActions(actions)).toEqual({ unchanged: 1, added: 0, updated: 1, pendingReview: 1, divergent: 0 });
  });

  it("compares text values without accents or case", () => {
    expect(sameValue({ valueText: "Apartamento", valueNumber: null }, { valueText: "apartamento ", valueNumber: null })).toBe(true);
  });
});

describe("question scope", () => {
  const carriers = [{ id: "amil", name: "Amil" }, { id: "assim", name: "Assim Saúde", aliases: ["Assim"] }];
  const plans = [
    { id: "s380", name: "S380 QC", carrierName: "Amil", carrierId: "amil" },
    { id: "s450", name: "Amil S450", carrierName: "Amil", carrierId: "amil" },
  ];

  it("finds the operators named in the question", () => {
    expect(carriersInQuestion("Qual a carência de parto da Amil?", carriers).map((carrier) => carrier.id)).toEqual(["amil"]);
    expect(carriersInQuestion("tabela assim saude pme", carriers).map((carrier) => carrier.id)).toEqual(["assim"]);
    expect(carriersInQuestion("quanto custa um plano?", carriers)).toEqual([]);
  });

  it("finds the plan written with spaces or without the operator", () => {
    expect(plansInQuestion("valor do S 380 QC para 35 anos", plans).map((plan) => plan.id)).toEqual(["s380"]);
    expect(plansInQuestion("rede do s450", plans).map((plan) => plan.id)).toEqual(["s450"]);
  });

  it("turns ages into ANS bands", () => {
    expect(ageBandsInQuestion("titular 35 anos e filho de 8 anos, mãe 60 anos")).toEqual(["34-38", "0-18", "59+"]);
    expect(ageBandsInQuestion("plano para a empresa")).toEqual([]);
  });
});

describe("plausibleValidUntil", () => {
  const importedAt = new Date("2026-10-22T18:00:00-03:00");
  it("drops an end on the import day (the print date read as validity)", () => {
    expect(plausibleValidUntil(new Date("2026-10-22T12:00:00-03:00"), importedAt)).toBeNull();
  });
  it("keeps a real end of validity", () => {
    const end = new Date("2026-12-31T12:00:00-03:00");
    expect(plausibleValidUntil(end, importedAt)).toBe(end);
  });
});

describe("ages in the question", () => {
  it("reads bare numbers after vidas as ages, not money", () => {
    expect(agesInQuestion("Planos PME - Porte I - Total de 2 vidas valor 33,24")).toEqual([33, 24]);
    expect(agesInQuestion("titular 42 e dependente 8")).toEqual([42, 8]);
  });
  it("keeps money, dates and the number of lives out", () => {
    expect(agesInQuestion("3 vidas, orçamento de R$ 900,00 até 10/11")).toEqual([]);
  });
  it("needs a word about people to read bare numbers", () => {
    expect(agesInQuestion("tabela PME porte I 33")).toEqual([]);
  });
});
