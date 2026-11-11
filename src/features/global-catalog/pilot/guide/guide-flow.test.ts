import { describe, expect, it } from "vitest";

import { applyGuideChoice, applyGuideText, guideAwaiting, guideProgress, matchCity, nextGuideBlocks, parseAges, parseBudget, shortEntity, toQuoteInput, uniqueCities, type GuideAnswers, type GuideFacets } from "./guide-flow";

const empty = { plans: 0, accommodations: [], coparticipations: [], entities: [], operators: [] };
const facets: GuideFacets = {
  sourceDate: "2026-11-11",
  totalPlans: 100,
  cities: uniqueCities(["NITEROI", "Niteroi", "Niterói", "Rio de Janeiro", "RIO DE JANEIRO", "São Gonçalo", "Rio Bonito"]),
  businessProfiles: ["EPP", "LTDA", "ME", "MEI", "SS", "TODOS_CNPJS"],
  modalities: {
    PESSOA_FISICA: { plans: 10, accommodations: [{ value: "Apartamento", count: 6 }, { value: "Enfermaria", count: 4 }], coparticipations: [{ value: "Sem Coparticipação", count: 7 }, { value: "Com Coparticipação", count: 3 }], entities: [], operators: [{ value: "op1", label: "Amil", count: 10 }] },
    ADESAO: { plans: 50, accommodations: [{ value: "Apartamento", count: 30 }, { value: "Enfermaria", count: 20 }], coparticipations: [{ value: "Com Coparticipação", count: 50 }], entities: [{ value: "OAB-RJ - Ordem dos Advogados", count: 9 }, { value: "SINPRO-RJ - Sindicato dos Professores", count: 4 }], operators: [] },
    PME_EMPRESARIAL: { plans: 30, accommodations: [{ value: "Apartamento", count: 30 }], coparticipations: [{ value: "Sem Coparticipação", count: 10 }, { value: "Coparticipação Total", count: 20 }], entities: [], operators: [] },
    PESSOA_FISICA_ODONTO: { ...empty, plans: 5 }, ADESAO_ODONTO: { ...empty, plans: 0 }, PME_EMPRESARIAL_ODONTO: { ...empty, plans: 5 },
  },
};

describe("cotação guiada", () => {
  it("pergunta tipo, público, município, idades e as preferências de saúde, nessa ordem", () => {
    let answers: GuideAnswers = {};
    const asked: string[] = [];
    for (const value of ["kind:saude", "audience:PESSOA_FISICA", "city:Niterói"]) {
      asked.push(guideAwaiting(answers, facets));
      answers = applyGuideChoice(answers, value, facets)!;
    }
    asked.push(guideAwaiting(answers, facets));
    const typed = applyGuideText(answers, "35, 32 e 8", facets, 1);
    expect("answers" in typed).toBe(true);
    if ("answers" in typed) answers = typed.answers;
    asked.push(guideAwaiting(answers, facets));
    answers = applyGuideChoice(answers, "accommodation:", facets)!;
    asked.push(guideAwaiting(answers, facets));
    answers = applyGuideChoice(answers, "coparticipation:Sem Coparticipação", facets)!;
    expect(asked).toEqual(["kind", "audience", "city", "ages", "accommodation", "coparticipation"]);
    expect(guideAwaiting(answers, facets)).toBe("done");
    expect(guideProgress(answers, facets)).toEqual({ title: "Montando a cotação", done: 6, total: 6 });
    expect(toQuoteInput(answers)).toMatchObject({ modality: "PESSOA_FISICA", city: "Niterói", accommodation: "", coparticipation: "Sem Coparticipação", lives: [{ age: 35, holder: true }, { age: 32, holder: false }, { age: 8, holder: false }] });
  });

  it("adesão pergunta a entidade e pula a coparticipação quando só há uma opção", () => {
    const answers: GuideAnswers = { kind: "saude", audience: "ADESAO", city: "Niterói", ages: [40] };
    expect(guideAwaiting(answers, facets)).toBe("entity");
    expect(applyGuideText(answers, "oab", facets, 2)).toEqual({ answers: { ...answers, entity: "OAB-RJ - Ordem dos Advogados" } });
    expect(guideProgress({ ...answers, entity: null }, facets).total).toBe(6);
  });

  it("PME pergunta tipo e tempo de empresa; odonto não pergunta acomodação", () => {
    const pme: GuideAnswers = { kind: "saude", audience: "PME_EMPRESARIAL", city: "Niterói", ages: [40, 30] };
    expect(guideAwaiting(pme, facets)).toBe("businessProfile");
    const withMonths = applyGuideChoice(applyGuideChoice(pme, "businessProfile:ME", facets)!, "businessMonths:12", facets)!;
    expect(withMonths.businessMonths).toBe(12);
    expect(guideAwaiting(withMonths, facets)).toBe("coparticipation");
    expect(guideAwaiting({ kind: "odonto", audience: "PESSOA_FISICA", city: "Niterói", ages: [30] }, facets)).toBe("done");
  });

  it("não oferece público sem planos e mostra a contagem em cada opção", () => {
    const [question] = nextGuideBlocks({ kind: "odonto" }, facets, 1);
    expect(question.type === "question" && question.choices.map((choice) => [choice.label, choice.hint])).toEqual([["Pessoa física", "5 planos"], ["Empresa (PME)", "5 planos"]]);
  });

  it("município: uma grafia por cidade, exato na hora e parcial em opções", () => {
    expect(facets.cities).toEqual(["Niterói", "Rio Bonito", "Rio de Janeiro", "São Gonçalo"]);
    expect(matchCity("niteroi", facets.cities)).toEqual({ city: "Niterói" });
    expect(matchCity("rio", facets.cities)).toEqual({ options: ["Rio Bonito", "Rio de Janeiro"] });
    expect("error" in matchCity("Curitiba", facets.cities)).toBe(true);
  });

  it("idades, orçamento e sigla da entidade", () => {
    expect(parseAges("35, 32 e 8")).toEqual({ ages: [35, 32, 8] });
    expect("error" in parseAges("abc")).toBe(true);
    expect(parseBudget("1.500")).toEqual({ cents: 150000 });
    expect(parseBudget("R$ 2 mil")).toEqual({ cents: 200000 });
    expect(parseBudget("1500,50")).toEqual({ cents: 150050 });
    expect(shortEntity("OAB-RJ - Ordem dos Advogados")).toBe("OAB-RJ");
  });
});
