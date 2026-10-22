import { describe, expect, it } from "vitest";

import { isOperatorKnowledgeQuestion, marketOperatorsInQuestion, numbersIn, operatorNotImportedMessage, relevantChunks, validateGroundedAnswer } from "./answer-guard";

describe("operator questions", () => {
  it("names market operators without mistaking common words or person names", () => {
    expect(marketOperatorsInQuestion("Qual a carência da Sul América?")).toEqual(["SulAmérica"]);
    expect(marketOperatorsInQuestion("tabela notredame pme")).toEqual(["NotreDame Intermédica"]);
    expect(marketOperatorsInQuestion("Assim Saúde tem rede em Niterói?")).toEqual(["Assim Saúde"]);
    expect(marketOperatorsInQuestion("assim que o cliente responder eu ligo")).toEqual([]);
    expect(marketOperatorsInQuestion("a Alice pediu retorno amanhã")).toEqual([]);
  });

  it("sends operator and plan content questions to the material only", () => {
    expect(isOperatorKnowledgeQuestion("quanto custa o plano da Amil?")).toBe(true);
    expect(isOperatorKnowledgeQuestion("qual a carência de parto?")).toBe(true);
    expect(isOperatorKnowledgeQuestion("tem coparticipação?")).toBe(true);
    expect(isOperatorKnowledgeQuestion("o plano S380 da Klini é bom?", ["Klini"])).toBe(true);
  });

  it("leaves a normal question about the broker's day with its assistant", () => {
    expect(isOperatorKnowledgeQuestion("quem eu atendo primeiro hoje?")).toBe(false);
    expect(isOperatorKnowledgeQuestion("o lead tem 3 vidas e quer apartamento, o que respondo?")).toBe(false);
    expect(isOperatorKnowledgeQuestion("primeiro retorno da tarde")).toBe(false);
  });

  it("says which operator is not imported", () => {
    expect(operatorNotImportedMessage(["Bradesco Saúde", "Unimed"])).toContain("Bradesco Saúde e Unimed");
  });
});

describe("validateGroundedAnswer", () => {
  const context = "[F1] Amil · S380 · Tabela de preços / Mensalidade (faixa_etaria: 34-38) = R$ 1.234,56 · válido até 31/12/2026\n[T1] Manual PME\nParto: 300 dias de carência.";
  const validIds = new Set(["F1", "T1"]);
  const question = "valor do S380 para 35 anos";

  it("accepts an answer whose numbers all come from the material or the question", () => {
    expect(validateGroundedAnswer({ answer: "Para 35 anos o S380 custa R$ 1.234,56 [F1], válido até 31/12/2026. Parto tem 300 dias [T1].", validIds, context, question })).toEqual({ ok: true });
  });

  it("blocks an answer without citation", () => {
    expect(validateGroundedAnswer({ answer: "O S380 custa R$ 1.234,56.", validIds, context, question })).toMatchObject({ ok: false, reason: "no_citation" });
  });

  it("blocks a citation that was not given", () => {
    expect(validateGroundedAnswer({ answer: "Custa R$ 1.234,56 [F7].", validIds, context, question })).toMatchObject({ ok: false, reason: "unknown_citation", detail: "F7" });
  });

  it("blocks a number the material does not have (invented or calculated)", () => {
    expect(validateGroundedAnswer({ answer: "Para o casal fica R$ 2.469,12 [F1].", validIds, context, question })).toMatchObject({ ok: false, reason: "number_without_source", detail: "2469.12" });
    expect(validateGroundedAnswer({ answer: "Carência de parto: 180 dias [T1].", validIds, context, question })).toMatchObject({ ok: false, reason: "number_without_source" });
  });

  it("does not take list markers for data", () => {
    expect(validateGroundedAnswer({ answer: "1. Mensalidade R$ 1.234,56 [F1]\n2. Parto 300 dias [T1]", validIds, context, question })).toEqual({ ok: true });
  });

  it("reads Brazilian numbers the same way on both sides", () => {
    expect([...numbersIn("R$ 1.234,56 e 10.000 vidas, 12,5%")]).toEqual(["1234.56", "10000", "12.5"]);
  });
});

describe("relevantChunks", () => {
  const chunk = (text: string, extra: Partial<{ keywordHits: number; semanticDistance: number | null; carrierId: string | null }> = {}) => ({ text, keywordHits: 2, semanticDistance: null, carrierId: null, ...extra });

  it("drops material of another operator", () => {
    const result = relevantChunks([chunk("Tabela Amil S380", { carrierId: "amil" }), chunk("Tabela Assim Saúde", { carrierId: "assim" })], { carrierIds: ["amil"], carrierNames: ["Amil"], keywordCount: 3 });
    expect(result.map((item) => item.carrierId)).toEqual(["amil"]);
  });

  it("keeps material not catalogued yet only when it names the operator", () => {
    const result = relevantChunks([chunk("Manual da Amil para PME"), chunk("Manual de vendas geral")], { carrierIds: ["amil"], carrierNames: ["Amil"], keywordCount: 3 });
    expect(result.map((item) => item.text)).toEqual(["Manual da Amil para PME"]);
  });

  it("drops excerpts far from the question", () => {
    const result = relevantChunks([
      chunk("parecido", { keywordHits: 0, semanticDistance: 0.3 }),
      chunk("longe", { keywordHits: 0, semanticDistance: 0.8 }),
      chunk("uma palavra", { keywordHits: 1 }),
    ], { carrierIds: [], carrierNames: [], keywordCount: 4 });
    expect(result.map((item) => item.text)).toEqual(["parecido"]);
  });
});
