import { describe, expect, it } from "vitest";

import { MARKETING_IMPORT_PF_COLUMNS, MARKETING_IMPORT_PME_COLUMNS, MARKETING_IMPORT_TEMPLATE_HEADERS, normalizeImportHeader } from "./columns";
import { buildImportProblemsCsv, importRowReason, sortImportRows, type ImportResultRow } from "./results";

const ROWS: ImportResultRow[] = [
  { rowIndex: 2, status: "created", message: null, nome: "Ana Exemplo", telefone: "5521999990000", leadId: "lead-1" },
  { rowIndex: 3, status: "invalid", message: "Telefone inválido; ID externo é obrigatório", nome: "Bruno", telefone: "55123", leadId: null },
  { rowIndex: 4, status: "duplicate", message: null, nome: "Carla \"Cacá\" Lima", telefone: "5521988887777", leadId: null },
  { rowIndex: 5, status: "invalid", message: null, nome: "=HYPERLINK(1)", telefone: "", leadId: null },
];

describe("CSV de problemas da importação", () => {
  it("sai com BOM, ponto e vírgula, cabeçalho em pt-BR e só as linhas que não entraram", () => {
    const csv = buildImportProblemsCsv(ROWS);
    expect(csv.startsWith("﻿Linha da planilha;Nome;Telefone;Situação;Motivo\r\n")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('"3";"Bruno";"55123";"Com problema";"Telefone inválido; ID externo é obrigatório"');
    expect(lines[2]).toBe('"4";"Carla ""Cacá"" Lima";"5521988887777";"Duplicado";"Já existe um lead com o mesmo ID, telefone ou e-mail"');
    expect(csv).not.toContain("Ana Exemplo");
  });

  it("protege contra fórmula e explica linha sem mensagem", () => {
    const csv = buildImportProblemsCsv(ROWS);
    expect(csv).toContain(`"'=HYPERLINK(1)"`);
    expect(csv).toContain('"Dados incompletos na linha"');
  });

  it("sem problema, devolve só o cabeçalho", () => {
    expect(buildImportProblemsCsv([ROWS[0]!])).toBe("﻿Linha da planilha;Nome;Telefone;Situação;Motivo");
  });

  it("motivo do lead criado e ordem da planilha com linhas antigas sem número no fim", () => {
    expect(importRowReason(ROWS[0]!)).toBe("Lead criado");
    const sorted = sortImportRows([{ ...ROWS[0]!, rowIndex: null }, ROWS[2]!, ROWS[1]!]);
    expect(sorted.map((row) => row.rowIndex)).toEqual([3, 4, null]);
  });
});

describe("planilha modelo", () => {
  it("traz todas as colunas obrigatórias do importador, PF e PME", () => {
    const pf = MARKETING_IMPORT_TEMPLATE_HEADERS.pf.map(normalizeImportHeader);
    const pme = MARKETING_IMPORT_TEMPLATE_HEADERS.pme.map(normalizeImportHeader);
    for (const column of MARKETING_IMPORT_PF_COLUMNS) expect(pf).toContain(normalizeImportHeader(column));
    for (const column of MARKETING_IMPORT_PME_COLUMNS) expect(pme).toContain(normalizeImportHeader(column));
    expect(pf).not.toContain("tipo de cnpj");
    expect(pme).not.toContain("tipo de plano");
    expect(pf).toContain("nome do formulario");
  });
});
