import { describe, expect, it, vi } from "vitest";

import { labSasaWorld } from "@/app/dev/laboratorio/sasa-lab";

import { readSasaPick, runSasaCommand, type SasaRun } from "./command-core";
import { classifySasaText, nameHintOf } from "./intent-rules";
import { parseWhenPtBr, whenLabel } from "./parse-when";
import { resolveLead } from "./resolve-entities";

// Quinta, 19/11/2026, 14:00 em São Paulo.
const now = new Date("2026-11-19T14:00:00-03:00");
const sp = (date: Date) => new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);

describe("parseWhenPtBr", () => {
  it.each([
    ["amanhã às 10", "sex., 20/11, 10:00", true],
    ["amanha as 10h30", "sex., 20/11, 10:30", true],
    ["sexta às 15h", "sex., 20/11, 15:00", true],
    ["sexta de tarde", "sex., 20/11, 14:00", true],
    ["segunda", "seg., 23/11, 09:00", false],
    ["às 3", "qui., 19/11, 15:00", true],
    ["às 9", "sex., 20/11, 09:00", true],
    ["hoje", "qui., 19/11, 18:00", false],
    ["depois de amanhã de manhã", "sáb., 21/11, 09:00", true],
    ["dia 25 às 11", "qua., 25/11, 11:00", true],
    ["02/12 meio-dia", "qua., 02/12, 12:00", true],
    ["quinta", "qui., 26/11, 09:00", false],
  ])("%s → %s", (text, expected, hasTime) => {
    const parsed = parseWhenPtBr(text, now);
    expect(parsed && sp(parsed.at)).toBe(expected);
    expect(parsed?.hasTime).toBe(hasTime);
  });

  it("entende tempo relativo e devolve null sem data", () => {
    expect(parseWhenPtBr("daqui a 2 horas", now)?.at.toISOString()).toBe(new Date(now.getTime() + 2 * 3_600_000).toISOString());
    expect(parseWhenPtBr("em meia hora", now)?.at.toISOString()).toBe(new Date(now.getTime() + 30 * 60_000).toISOString());
    expect(parseWhenPtBr("marca retorno com a Ana", now)).toBeNull();
  });

  it("nomeia a data como o corretor fala", () => {
    expect(whenLabel(new Date("2026-11-20T10:00:00-03:00"), now)).toBe("amanhã às 10:00");
    expect(whenLabel(new Date("2026-11-19T17:30:00-03:00"), now)).toBe("hoje às 17:30");
  });
});

describe("classifySasaText", () => {
  it.each([
    ["qual é meu próximo plantão?", { tool: "duty.next" }],
    ["pausa meu plantão", { tool: "duty.pause" }],
    ["não quero mais receber agora", { tool: "duty.pause" }],
    ["volta a me mandar lead, quero receber", { tool: "duty.resume" }],
    ["quem está esperando resposta?", { tool: "leads.waiting" }],
    ["Quem eu atendo primeiro agora?", { tool: "leads.waiting" }],
    ["o que tenho na agenda hoje?", { tool: "agenda.list" }],
    ["marca retorno com a Ana amanhã às 10", { tool: "returns.schedule", reschedule: false }],
    ["me lembra de ligar pro Pedro sexta", { tool: "returns.schedule", reschedule: false }],
    ["liga pra Ana amanhã", { tool: "returns.schedule", reschedule: false }],
    ["joga o retorno do Pedro pra segunda", { tool: "returns.schedule", reschedule: true }],
    ["cancela o retorno do Pedro", { tool: "returns.cancel" }],
    ["já liguei pra Ana", { tool: "returns.complete" }],
    ["mandei a cotação pro Carlos", { tool: "lead.stage", status: "quote_sent" }],
    ["o Carlos está em negociação", { tool: "lead.stage", status: "negotiation" }],
  ])("%s", (text, intent) => {
    expect(classifySasaText(text)).toEqual(intent);
  });

  it("deixa para a IA o que não é pedido", () => {
    expect(classifySasaText("qual a carência da Amil?")).toBeNull();
    expect(classifySasaText("bom dia")).toBeNull();
  });

  it("pega o nome dito para dizer quem não achou", () => {
    expect(nameHintOf("Marca retorno com o Roberto amanhã")).toBe("Roberto");
  });
});

describe("resolveLead", () => {
  const leads = labSasaWorld(now).leads;
  it("nome completo vence; primeiro nome repetido vira escolha", () => {
    expect(resolveLead("mandei a cotação pro Carlos Mendes", leads)).toMatchObject({ kind: "one", lead: { id: "lab-carlos-m" } });
    expect(resolveLead("retorno com o Carlos", leads)).toMatchObject({ kind: "many", leads: [{ id: "lab-carlos-t" }, { id: "lab-carlos-m" }] });
    expect(resolveLead("já liguei pra julia", leads)).toMatchObject({ kind: "one", lead: { id: "lab-julia" } });
    expect(resolveLead("retorno com o Roberto", leads)).toEqual({ kind: "none" });
  });
});

describe("runSasaCommand", () => {
  const okRun = (): SasaRun => vi.fn(async (name) => ({ ok: true, message: "ok", undo: { label: "Desfazer", action: { kind: "server" as const, name, payload: {} } } }));

  it("marca retorno com hora exata pela ação existente e oferece Desfazer", async () => {
    const run = okRun();
    const world = labSasaWorld(now);
    const reply = await runSasaCommand({ text: "Marca retorno com a Ana amanhã às 10", world, run, stamp: "t" });
    expect(run).toHaveBeenCalledWith("lead.scheduleReturn", { leadId: "lab-ana", at: new Date("2026-11-20T10:00:00-03:00").toISOString() });
    expect(reply.executed).toEqual({ action: "lead.scheduleReturn", ok: true, warning: undefined });
    expect(reply.blocks[0]).toMatchObject({ type: "assistant", text: "Combinado: retorno com Ana amanhã às 10:00. Está na sua Agenda." });
    expect(reply.blocks[1]).toMatchObject({ type: "question", choices: [{ label: "Desfazer" }] });
  });

  it("pergunta qual Carlos e repete o pedido com o escolhido", async () => {
    const run = okRun();
    const world = labSasaWorld(now);
    const ask = await runSasaCommand({ text: "Marca retorno com o Carlos sexta às 15h", world, run, stamp: "t" });
    expect(run).not.toHaveBeenCalled();
    const question = ask.blocks[0];
    expect(question).toMatchObject({ type: "question", prompt: "Qual Carlos?" });
    const choice = question?.type === "question" ? question.choices[1]! : null;
    const pick = readSasaPick(choice?.action.kind === "local" ? choice.action.value : "");
    expect(pick).toEqual({ text: "Marca retorno com o Carlos sexta às 15h", leadId: "lab-carlos-m" });
    await runSasaCommand({ text: pick!.text, pickedLeadId: pick!.leadId, world, run, stamp: "t" });
    expect(run).toHaveBeenCalledWith("lead.scheduleReturn", expect.objectContaining({ leadId: "lab-carlos-m" }));
  });

  it("nunca aceita um lead escolhido que não é do corretor", async () => {
    const run = okRun();
    const reply = await runSasaCommand({ text: "marca retorno com o Carlos amanhã", pickedLeadId: "lead-de-outro", world: labSasaWorld(now), run });
    expect(run).not.toHaveBeenCalled();
    expect(reply.blocks[0]).toMatchObject({ text: "Esse lead não está mais com você. Nada foi alterado." });
  });

  it("sem data pergunta em toques; remarcar substitui o retorno aberto", async () => {
    const run = okRun();
    const world = labSasaWorld(now);
    const noWhen = await runSasaCommand({ text: "marca retorno com o Pedro", world, run, stamp: "t" });
    expect(noWhen.blocks[0]).toMatchObject({ type: "question", prompt: "Para quando o retorno com Pedro?" });
    await runSasaCommand({ text: "joga o retorno do Pedro pra segunda às 10", world, run, stamp: "t" });
    const pedroTask = world.returns.find((item) => item.leadId === "lab-pedro")!.taskId;
    expect(run).toHaveBeenCalledWith("lead.scheduleReturn", expect.objectContaining({ leadId: "lab-pedro", taskId: pedroTask }));
  });

  it("muda etapa mandando a anterior, conclui retorno e pausa", async () => {
    const run = okRun();
    const world = labSasaWorld(now);
    await runSasaCommand({ text: "mandei a cotação pro Carlos Mendes", world, run });
    expect(run).toHaveBeenCalledWith("lead.changeStep", { leadId: "lab-carlos-m", status: "quote_sent", previous: "in_contact" });
    await runSasaCommand({ text: "já liguei pro Pedro", world, run });
    expect(run).toHaveBeenCalledWith("lead.completeReturn", expect.objectContaining({ leadName: "Pedro" }));
    await runSasaCommand({ text: "pausa meu plantão", world, run });
    expect(run).toHaveBeenCalledWith("duty.pause", {});
  });

  it("responde leituras sem executar nada", async () => {
    const run = okRun();
    const world = labSasaWorld(now);
    const duty = await runSasaCommand({ text: "qual é meu próximo plantão?", world, run, stamp: "t" });
    expect(duty.blocks[0]).toMatchObject({ type: "assistant", text: expect.stringContaining("Você está no plantão TESTE") });
    const waiting = await runSasaCommand({ text: "quem está esperando?", world, run, stamp: "t" });
    expect(waiting.blocks[1]).toMatchObject({ type: "leads", rows: [{ leadId: "lab-julia" }, { leadId: "lab-carlos-m" }] });
    const agenda = await runSasaCommand({ text: "o que tenho na agenda hoje?", world, run, stamp: "t" });
    expect(agenda.blocks[0]).toMatchObject({ text: "Hoje você tem 2 retornos, 1 atrasado." });
    expect(run).not.toHaveBeenCalled();
  });

  it("falha diz o que continua valendo e oferece Tentar de novo", async () => {
    const run: SasaRun = vi.fn(async () => ({ ok: false, message: "erro técnico" }));
    const reply = await runSasaCommand({ text: "pausa meu plantão", world: labSasaWorld(now), run, stamp: "t" });
    expect(reply.executed).toEqual({ action: "duty.pause", ok: false });
    expect(reply.blocks[0]).toMatchObject({ text: "Não consegui pausar. Você continua recebendo." });
    expect(reply.blocks[1]).toMatchObject({ type: "question", choices: [{ label: "Tentar de novo" }] });
  });

  it("devolve a vez para a IA quando não é pedido", async () => {
    const reply = await runSasaCommand({ text: "qual a carência da Amil?", world: labSasaWorld(now), run: okRun() });
    expect(reply).toEqual({ handled: false, blocks: [] });
  });
});
