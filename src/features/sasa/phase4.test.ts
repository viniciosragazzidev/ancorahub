import { describe, expect, it, vi } from "vitest";

import { labSasaWorld, LAB_SASA_SPEECH } from "@/app/dev/laboratorio/sasa-lab";
import { saleAwaiting, type SaleCatalog } from "@/features/post-sale/conversation-sale-core";

import { runSasaCommand } from "./command-core";
import { mergeSpokenQuote, mergeSpokenSale } from "./draft-merge";
import { mentionedIn, parseSpokenQuote, parseSpokenSale, spokenAges, spokenMoney } from "./drafts";
import { classifySasaText } from "./intent-rules";

// Quinta, 19/11/2026, 14:00 em São Paulo.
const now = new Date("2026-11-19T14:00:00-03:00");
const catalog: SaleCatalog = {
  carriers: [
    { id: "amil", name: "Amil", plans: [{ id: "amil-s380", name: "Amil S380", type: "familiar" }, { id: "amil-s450", name: "Amil S450", type: "familiar" }] },
    { id: "sulamerica", name: "SulAmérica", plans: [{ id: "sula-exato", name: "SulAmérica Exato", type: "familiar" }] },
  ],
};

describe("intenções da fase 4", () => {
  it.each([
    ["Fechou a venda do Carlos, Amil, 3 vidas", { tool: "sale.start" }],
    ["fechei com a Ana hoje", { tool: "sale.start" }],
    ["A Ana disse que vai ver com o marido", { tool: "lead.note" }],
    ["o Pedro pediu pra mandar a cotação da Amil", { tool: "lead.note" }],
    ["cotação para 3 vidas, 35, 32 e 8", { tool: "quote.start" }],
    ["simula um familiar com 2 adultos", { tool: "quote.start" }],
    ["mandei a cotação pro Carlos", { tool: "lead.stage", status: "quote_sent" }],
    ["já falei com a Ana", { tool: "returns.complete" }],
    ["a Ana vai fechar semana que vem", null],
  ])("%s", (text, intent) => {
    expect(classifySasaText(text)).toEqual(intent);
  });
});

describe("o que foi dito vira dados", () => {
  it("idades, valor e vigência", () => {
    expect(spokenAges("3 vidas, 35, 32 e 8 anos")).toEqual([35, 32, 8]);
    expect(spokenAges("idades 40 e 38")).toEqual([40, 38]);
    expect(spokenAges("só ela, de 52 anos")).toEqual([52]);
    expect(spokenAges("Amil por R$ 1.290")).toBeUndefined();
    expect(spokenMoney("R$ 1.290 por mês")).toBe(1290);
    expect(spokenMoney("1.290,50 reais")).toBe(1290.5);
    expect(parseSpokenSale("fechou, Amil S380 familiar, começa dia 1º", now)).toMatchObject({ planType: "familiar", coverageStartDate: "2026-12-01" });
    expect(parseSpokenQuote("cotação PME para 4 vidas, 40, 38, 10 e 7 anos")).toMatchObject({ audience: "PME_EMPRESARIAL", ages: [40, 38, 10, 7], kind: "saude" });
  });

  it("acha operadora e plano por palavra inteira (Amil não casa dentro de familiar)", () => {
    expect(mentionedIn(catalog.carriers, "plano familiar da SulAmérica")?.id).toBe("sulamerica");
    expect(mentionedIn(catalog.carriers, "plano familiar")).toBeNull();
    const plans = catalog.carriers.flatMap((carrier) => carrier.plans);
    expect(mentionedIn(plans, "amil s380 familiar")?.id).toBe("amil-s380");
  });

  it("a venda abre preenchida como informado pelo corretor, perguntando só o que falta", () => {
    const { answers, found } = mergeSpokenSale(parseSpokenSale(LAB_SASA_SPEECH.venda, now), catalog, now);
    expect(answers).toMatchObject({ planType: "familiar", ages: [35, 32, 8], carrierId: "amil", planId: "amil-s380", monthlyValue: 1290, fromContract: false, sourced: [] });
    expect(found.slice(0, 4)).toEqual(["tipo Familiar", "3 vidas", "Amil", "plano Amil S380"]);
    expect(found[4]?.replace(/\s/g, " ")).toBe("valor R$ 1.290,00");
    // 26/11/2026: o titular é confirmado antes de tudo; depois dele, só falta a vigência.
    expect(saleAwaiting(answers, catalog)).toBe("holderName");
    expect(saleAwaiting({ ...answers, holder: { name: "Carlos Silva", document: { kind: "cpf", digits: "52998224725" }, birthDate: "1990-01-01" } }, catalog)).toBe("start");
  });

  it("a cotação abre com as idades, o tipo e a cidade ditos", () => {
    const { answers, found } = mergeSpokenQuote(parseSpokenQuote("cotação para 3 vidas, 35, 32 e 8 anos em Niterói"), { cities: ["Niterói", "Rio de Janeiro"] });
    expect(answers).toEqual({ kind: "saude", city: "Niterói", ages: [35, 32, 8] });
    expect(found).toEqual(["Niterói", "3 vidas (35, 32, 8 anos)"]);
  });
});

describe("runSasaCommand na fase 4", () => {
  const run = vi.fn(async () => ({ ok: true, message: "ok" }));

  it("fechou a venda: abre o registro do lead certo com o rascunho, sem executar nada", async () => {
    run.mockClear();
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.venda, world: labSasaWorld(now), run, stamp: "t" });
    expect(run).not.toHaveBeenCalled();
    expect(reply.open).toMatchObject({ kind: "sale", leadId: "lab-carlos-t", href: "/leads/lab-carlos-t/registrar-venda", draft: { ages: [35, 32, 8], monthlyValue: 1290, planType: "familiar" } });
    expect(reply.blocks[0]).toMatchObject({ text: expect.stringContaining("Abrindo o registro da venda de Carlos com o que você disse: tipo familiar, 3 vidas, R$ 1.290,00") });
  });

  it("o cliente disse: anota e sugere etapa e retorno, um toque cada", async () => {
    run.mockClear();
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.disse, world: labSasaWorld(now), run, stamp: "t" });
    expect(run).toHaveBeenCalledWith("lead.addNote", { leadId: "lab-ana", content: LAB_SASA_SPEECH.disse });
    expect(reply.blocks[0]).toMatchObject({ text: "Anotei no histórico de Ana." });
    const next = reply.blocks.find((block) => block.id === "sasa-note-next-t");
    expect(next).toMatchObject({ type: "question", prompt: "E com Ana, quer também:" });
    const choices = next?.type === "question" ? next.choices : [];
    expect(choices.map((choice) => choice.label)).toEqual(["Mudar para Em negociação", "Retorno amanhã às 10:00"]);
    expect(choices[1]!.action).toMatchObject({ kind: "server", name: "lead.scheduleReturn", payload: { leadId: "lab-ana", at: new Date("2026-11-20T10:00:00-03:00").toISOString() } });
  });

  it("cotação: abre com as idades", async () => {
    const reply = await runSasaCommand({ text: LAB_SASA_SPEECH.cotacao, world: labSasaWorld(now), run, stamp: "t" });
    expect(reply.open).toMatchObject({ kind: "quote", href: "/cotacao", draft: { ages: [35, 32, 8], audience: "PESSOA_FISICA" } });
  });
});
