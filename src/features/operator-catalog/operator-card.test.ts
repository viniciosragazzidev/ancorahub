import { describe, expect, it } from "vitest";

import { buildOperatorCard, flattenAnswer, operatorAnswerSchema, operatorCardText, stripCitations } from "./operator-card";

const json = operatorAnswerSchema.parse({
  found: true,
  intro: "Amil S380 para 2 vidas (33 e 24 anos), demais empresas, coparticipação 30%.",
  sections: [
    { title: "**Amil S380 · QC**", rows: [
      { label: "33 anos (29-33)", value: "R$ 391,50", cite: "F2" },
      { label: "24 anos (24-28)", value: "R$ 326,25", cite: ["F1"] },
      { label: "Total", value: "R$ 717,75", cite: "F1, F2" },
    ] },
    { title: "Vazia", rows: [] },
  ],
  notes: ["Preço ainda não conferido pelo diretor [F1]"],
});

describe("operator card", () => {
  it("flattens with citations for the grounding guard", () => {
    const text = flattenAnswer(json);
    expect(text).toContain("- 33 anos (29-33): R$ 391,50 [F2]");
    expect(text).toContain("- Total: R$ 717,75 [F1] [F2]");
    expect(text).not.toContain("Vazia");
  });

  it("builds the card with sources and no citations", () => {
    const card = buildOperatorCard(json, new Map([["F1", "Tabela Amil.pdf"], ["F2", "Tabela Amil.pdf"]]), null);
    expect(card.sections).toHaveLength(1);
    expect(card.sections[0]!.title).toBe("Amil S380 · QC");
    expect(card.sections[0]!.rows[0]).toEqual({ label: "33 anos (29-33)", value: "R$ 391,50", source: "Tabela Amil.pdf" });
    expect(card.notes).toEqual(["Preço ainda não conferido pelo diretor"]);
    expect(card.sources).toEqual(["Tabela Amil.pdf"]);
  });

  it("copies a clean text for the client", () => {
    const card = buildOperatorCard(json, new Map(), null);
    expect(operatorCardText(card)).toContain("• Total: R$ 717,75");
    expect(operatorCardText(card)).not.toContain("diretor");
  });

  it("survives a broken model output", () => {
    const broken = operatorAnswerSchema.parse({ found: true, sections: "x", notes: 3 });
    expect(broken.sections).toEqual([]);
    expect(broken.notes).toEqual([]);
    expect(stripCitations("Hospital X [F38] e Y [T1, T2]")).toBe("Hospital X e Y");
  });
});
