import { extractText, getDocumentProxy } from "unpdf";
import { describe, expect, it } from "vitest";

import { formatCents } from "./contracts";
import { offerValidUntil, renderQuotePdf } from "./pdf";
import { offerFrom } from "./test-fixtures";

function plan(id: string, operator: string, totalCents: number, to: string | null = null) {
  return {
    id, name: `Plano ${id}`, code: id, operator, operatorId: operator, administrator: "", modality: "PESSOA_FISICA", accommodation: "Apartamento",
    coparticipation: "Sem coparticipação", coverage: "", entity: "", dental: null, minAge: null, maxAge: null, holderMin: null, holderMax: null,
    dependentMin: null, dependentMax: null, minLives: null, maxLives: null, minHolders: null, ageConfirmed: true, eligibilityConfirmed: true,
    businessConfirmed: true, from: null, to: null, networkCount: 0, detailCount: 0, totalCents,
    perLife: [{ age: 30, holder: true, priceId: `${id}-p`, cents: totalCents, from: null, to }], state: "ready" as const, reasons: [],
  };
}

describe("PDF de cotação", () => {
  it("todo valor sai do snapshot e o texto tem acento", async () => {
    const offer = offerFrom([plan("a", "Klini", 41990), plan("b", "Leve", 47710)], { recommendationReason: "Eu indicaria o Klini Plano a porque não tem coparticipação." });
    const buffer = await renderQuotePdf({
      offer, facts: { firstName: "Joana", neighborhood: "Icaraí" }, customerName: "Joana", brokerage: { name: "Âncora Saúde", phone: null, units: ["Niterói Centro"] },
      promotions: [], network: { planId: "a", units: [{ name: "Hospital São João", type: "Hospital", neighborhood: "Icaraí" }] }, generatedAt: new Date("2026-11-12T12:00:00Z"),
    });
    const document = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(document, { mergePages: true });
    expect(text).toContain("Cotação de plano de saúde para Joana");
    expect(text).toContain("Âncora Saúde");
    expect(text).toContain("Hospital São João");
    expect(text).toContain(formatCents(41990));
    expect(text).toContain(formatCents(47710));
    expect(text).toContain("vencimento: 1, 5, 10 ou 20");
    // Nenhum outro valor em reais além dos do snapshot.
    const values = [...text.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((match) => Number(match[1].replace(/\./g, "").replace(",", ".")) * 100);
    expect(values.every((value) => [41990, 47710].includes(Math.round(value)))).toBe(true);
    expect(text).not.toMatch(/[—–]/);
  });

  it("validade é o menor entre 7 dias e o fim da vigência do preço", () => {
    expect(offerValidUntil(offerFrom([plan("a", "Klini", 1000)]))).toBe("2026-11-19");
    expect(offerValidUntil(offerFrom([plan("a", "Klini", 1000, "2026-11-15")]))).toBe("2026-11-15");
  });
});
