import { describe, expect, it } from "vitest";

import { encodeCsvDocument, encodeCsvRow } from "./csv-export";

describe("CSV pt-BR", () => {
  it("gera BOM, usa ponto e vírgula, escapa aspas e protege fórmula", () => {
    const csv = encodeCsvDocument([{ Nome: "Ana; Silva", Nota: 'disse "sim"', Campo: "=1+1" }]);
    expect(csv.startsWith("\uFEFFNome;Nota;Campo\r\n")).toBe(true);
    expect(csv).toContain('"Ana; Silva";"disse ""sim""";"\'=1+1"');
  });

  it("serializa um registro com colunas fixas durante streaming", () => {
    expect(encodeCsvRow({ Nome: "Lead", Telefone: null }, ["Nome", "Telefone"])).toBe('"Lead";""');
  });
});
