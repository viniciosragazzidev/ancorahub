import { describe, expect, it } from "vitest";

import {
  SELECTED_LEAD_EXPORT_COLUMNS,
  buildSelectedLeadExportRow,
  buildSelectedLeadsCsv,
  buildSelectedLeadsFilename,
  normalizeSelectedLeadIds,
  selectedLeadsExportMessage,
  type SelectedLeadExportSource,
} from "./selected-lead-export";

const lead: SelectedLeadExportSource = {
  id: "l1",
  nome: "Maria \"Mari\" Souza",
  telefone: "21 99999-0001",
  email: "maria@exemplo.com",
  status: "quote_sent",
  corretorNome: "Ana Lima",
  queueName: "PME",
  branchName: "Centro",
  origem: "meta",
  sourceChannel: "meta_lead_ads",
  sourceCampaign: "Black Friday",
  monthlyValue: "1234.5",
  livesCount: 3,
  createdAt: new Date("2026-11-20T13:00:00.000Z"),
  assignedAt: new Date("2026-11-21T12:30:00.000Z"),
  updatedAt: "2026-11-24T18:45:00.000Z",
};

describe("buildSelectedLeadExportRow", () => {
  it("traz as colunas úteis em pt-BR", () => {
    const row = buildSelectedLeadExportRow(lead, "director");
    expect(Object.keys(row)).toEqual([...SELECTED_LEAD_EXPORT_COLUMNS]);
    expect(row).toMatchObject({
      "Nome": "Maria \"Mari\" Souza",
      "Etapa": "Cotação enviada",
      "Corretor": "Ana Lima",
      "Fila": "PME",
      "Unidade": "Centro",
      "Origem": "Meta (anúncios) · Black Friday",
      "Vidas": 3,
      "Criado em": "20/11/2026, 10:00",
      "Última atualização": "24/11/2026, 15:45",
    });
    expect(String(row["Valor mensal"]).replace(/\s/g, " ")).toBe("R$ 1.234,50");
  });

  it("deixa vazio o que não existe", () => {
    const row = buildSelectedLeadExportRow({ ...lead, email: null, corretorNome: null, queueName: null, branchName: null, monthlyValue: null, livesCount: null, updatedAt: null }, "director");
    expect(row).toMatchObject({ "E-mail": "", "Corretor": "", "Fila": "", "Unidade": "", "Valor mensal": "", "Vidas": "" });
    expect(row["Última atualização"]).toBe(row["Criado em"]);
  });

  it("esconde a origem e a chegada para o corretor", () => {
    const row = buildSelectedLeadExportRow(lead, "broker");
    expect(row["Origem"]).toBe("");
    expect(row["Criado em"]).toBe("21/11/2026, 09:30");
  });
});

describe("buildSelectedLeadsCsv", () => {
  it("usa BOM, ponto e vírgula e aspas escapadas, na ordem da seleção", () => {
    const other = { ...lead, id: "l2", nome: "=HYPERLINK(\"x\")", email: null };
    const csv = buildSelectedLeadsCsv([lead, other], ["l2", "l1"], "director");
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).trimEnd().split("\r\n");
    expect(lines[0]).toBe(SELECTED_LEAD_EXPORT_COLUMNS.join(";"));
    expect(lines).toHaveLength(3);
    expect(lines[1].startsWith("\"'=HYPERLINK(\"\"x\"\")\";")).toBe(true);
    expect(lines[2].startsWith("\"Maria \"\"Mari\"\" Souza\";\"21 99999-0001\"")).toBe(true);
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("apoio", () => {
  it("normaliza ids repetidos e vazios", () => {
    expect(normalizeSelectedLeadIds(["a", " a ", "", 3, "b"])).toEqual(["a", "b"]);
  });

  it("nomeia o arquivo pelo horário de Brasília", () => {
    expect(buildSelectedLeadsFilename(new Date("2026-11-25T02:05:00.000Z"))).toBe("leads-2026-11-24-2305.csv");
  });

  it("avisa o que ficou de fora", () => {
    expect(selectedLeadsExportMessage(1, 1)).toBe("1 lead exportado.");
    expect(selectedLeadsExportMessage(3, 5)).toBe("3 leads exportados. 2 ficaram de fora por não estarem no seu acesso.");
  });
});
