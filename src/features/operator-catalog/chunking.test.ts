import { describe, expect, it } from "vitest";

import { chunkContextHeader, isHeadingLine, isTableRow, structuredChunks } from "./chunking";

const table = [
  "Tabela de Preços - Linha Selecionada",
  "Planos PME - Porte I - Total de 2 vidas",
  "Com Coparticipação 30%",
  "Plano Amil S380 Amil S380 Amil S450 Amil S450",
  "00-18 228,56 253,69 263,25 292,21",
  "19-23 267,42 296,82 308,00 341,89",
  "24-28 326,25 362,12 375,76 417,11",
  "29-33 391,50 434,54 450,91 500,53",
  "34-38 411,08 456,27 473,46 525,56",
].join("\n");

describe("structuredChunks", () => {
  it("tells table rows and section titles apart", () => {
    expect(isTableRow("29-33 391,50 434,54 450,91 500,53")).toBe(true);
    expect(isTableRow("Com Coparticipação 30%")).toBe(false);
    expect(isHeadingLine("Planos PME - Porte I - Total de 2 vidas")).toBe(true);
    expect(isHeadingLine("Os preços mencionados acima são válidos por tempo limitado e podem sofrer alterações.")).toBe(false);
  });

  it("keeps the section title and the table header with every piece of a long table", () => {
    const chunks = structuredChunks(table, { maxChars: 230, overlapChars: 0 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk).toContain("Porte I - Total de 2 vidas");
      if (/\d{2}-\d{2} \d/.test(chunk)) expect(chunk).toContain("Plano Amil S380");
    }
    // Each age band row appears once across all chunks (no doubled prices).
    expect(chunks.join("\n").match(/^29-33 /gm)).toHaveLength(1);
  });

  it("never cuts a line and overlaps plain text between chunks", () => {
    const text = Array.from({ length: 30 }, (_, index) => `Regra ${index}: a carência de consultas é de 30 dias para todos os planos desta linha.`).join("\n");
    const chunks = structuredChunks(text, { maxChars: 400, overlapChars: 120 });
    expect(chunks.length).toBeGreaterThan(2);
    for (const chunk of chunks) for (const line of chunk.split("\n")) expect(line.length).toBeLessThanOrEqual(400);
    const lastOfFirst = chunks[0]!.split("\n").at(-1)!;
    expect(chunks[1]).toContain(lastOfFirst);
  });

  it("writes the context header with operator, type, title and plans", () => {
    expect(chunkContextHeader({ carrierName: "Amil", documentLabel: "Tabela de preços", title: "PME Porte I", plans: ["S380", "S450"] }))
      .toBe("[Amil · Tabela de preços · PME Porte I · Planos: S380, S450]");
  });
});
