import { describe, expect, it } from "vitest";

import {
  calendarDaysBetween,
  classifyClosingOutcome,
  closingOutcomeNotice,
  closingOutcomeNotificationKey,
  isPersonActor,
  leavesClosingStage,
  parseClosingHoldDate,
  pendingClosingOutcome,
  summarizeClosingOutcomes,
} from "./closing-outcome-core";

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-09T15:00:00.000Z");

describe("desfecho do fechamento: classificação", () => {
  it("só pessoas geram desfecho; regra, sistema e IA não", () => {
    expect(isPersonActor("broker")).toBe(true);
    expect(isPersonActor("director")).toBe(true);
    expect(isPersonActor("rule")).toBe(false);
    expect(isPersonActor("system")).toBe(false);
    expect(isPersonActor("ai")).toBe(false);
    expect(isPersonActor(null)).toBe(false);
  });

  it("sair do fechamento é desfecho; andar dentro dele ou entrar não é", () => {
    expect(leavesClosingStage("under_analysis", "converted")).toBe(true);
    expect(leavesClosingStage("documentation_pending", "lost")).toBe(true);
    expect(leavesClosingStage("documentation_pending", "under_analysis")).toBe(false);
    expect(leavesClosingStage("negotiation", "under_analysis")).toBe(false);
    expect(leavesClosingStage(null, "converted")).toBe(false);
  });

  it("classifica fechou, perdeu com motivo e voltou para a etapa", () => {
    expect(classifyClosingOutcome({ toStatus: "converted" })).toEqual({ kind: "converted", label: "Fechou", lossLabel: null });
    expect(classifyClosingOutcome({ toStatus: "lost", lossCode: "preco" })).toEqual({ kind: "lost", label: "Perdeu", lossLabel: "Preço acima do esperado" });
    expect(classifyClosingOutcome({ toStatus: "lost" }).lossLabel).toBe("Motivo não informado");
    expect(classifyClosingOutcome({ toStatus: "negotiation" })).toEqual({ kind: "returned", label: "Voltou para Negociação", lossLabel: null });
  });

  it("monta o aviso com valor, motivo e dias, sem travessão", () => {
    const sold = closingOutcomeNotice({ leadName: "Ana", brokerName: "Tainá Pinto", outcome: classifyClosingOutcome({ toStatus: "converted" }), value: "850.5", daysInClosing: 12 });
    expect(sold.title).toBe("Desfecho do fechamento: Ana fechou");
    expect(sold.message).toContain("Corretor: Tainá Pinto");
    expect(sold.message).toMatch(/Valor: R\$\s?850,50\/mês/);
    expect(sold.message).toContain("12 dias no fechamento");
    const lost = closingOutcomeNotice({ leadName: "Bia", brokerName: null, outcome: classifyClosingOutcome({ toStatus: "lost", lossCode: "desistiu" }), daysInClosing: 1 });
    expect(lost.message).toContain("Motivo: Desistiu da contratação");
    expect(lost.message).toContain("1 dia no fechamento");
    const back = closingOutcomeNotice({ leadName: "Caio", brokerName: "X", outcome: classifyClosingOutcome({ toStatus: "quote_sent" }), daysInClosing: null });
    expect(back.title).toBe("Desfecho do fechamento: Caio voltou para cotação enviada");
    for (const text of [sold, lost, back].flatMap((notice) => Object.values(notice))) expect(text).not.toContain(String.fromCharCode(0x2014));
  });

  it("a chave é única por lead, transição e diretor", () => {
    const changedAt = new Date("2026-11-09T12:00:00.000Z");
    expect(closingOutcomeNotificationKey({ leadId: "l1", changedAt, recipientUserId: "d1" })).toBe(`lead-closing-outcome:l1:${changedAt.getTime()}:d1`);
    expect(closingOutcomeNotificationKey({ leadId: "l1", changedAt, recipientUserId: "d2" })).not.toBe(closingOutcomeNotificationKey({ leadId: "l1", changedAt, recipientUserId: "d1" }));
  });

  it("conta dias corridos", () => {
    expect(calendarDaysBetween(new Date(now.getTime() - 10.5 * day), now)).toBe(10);
    expect(calendarDaysBetween(now, new Date(now.getTime() - day))).toBe(0);
  });
});

describe("desfecho pendente", () => {
  it("fica pendente depois de mais de 10 dias corridos no fechamento", () => {
    expect(pendingClosingOutcome({ status: "under_analysis", stageEnteredAt: new Date(now.getTime() - 11 * day), holdUntil: null, now }).pending).toBe(true);
    expect(pendingClosingOutcome({ status: "under_analysis", stageEnteredAt: new Date(now.getTime() - 10 * day), holdUntil: null, now }).pending).toBe(false);
    expect(pendingClosingOutcome({ status: "negotiation", stageEnteredAt: new Date(now.getTime() - 40 * day), holdUntil: null, now }).pending).toBe(false);
  });

  it("a data prevista silencia até passar", () => {
    const entered = new Date(now.getTime() - 30 * day);
    const held = pendingClosingOutcome({ status: "documentation_pending", stageEnteredAt: entered, holdUntil: new Date(now.getTime() + day), now });
    expect(held.pending).toBe(false);
    expect(held.heldUntil).not.toBeNull();
    expect(held.daysInClosing).toBe(30);
    expect(pendingClosingOutcome({ status: "documentation_pending", stageEnteredAt: entered, holdUntil: new Date(now.getTime() - day), now }).pending).toBe(true);
  });

  it("valida a data prevista: de amanhã até 60 dias", () => {
    expect(parseClosingHoldDate("2026-11-20", now)).toEqual({ ok: true, until: new Date("2026-11-21T02:59:59.000Z") });
    expect(parseClosingHoldDate("2026-11-09", now).ok).toBe(false);
    expect(parseClosingHoldDate("2027-02-01", now).ok).toBe(false);
    expect(parseClosingHoldDate("2026-02-30", now).ok).toBe(false);
    expect(parseClosingHoldDate("", now).ok).toBe(false);
  });
});

describe("resumo para a direção", () => {
  it("conta entradas e desfechos de pessoas e ignora regra e sistema", () => {
    const summary = summarizeClosingOutcomes({
      periodDays: 30,
      transitions: [
        { leadId: "a", brokerId: "t", brokerName: "Tainá", fromStatus: "negotiation", toStatus: "documentation_pending", actorType: "broker" },
        { leadId: "a", brokerId: "t", brokerName: "Tainá", fromStatus: "documentation_pending", toStatus: "under_analysis", actorType: "broker" },
        { leadId: "a", brokerId: "t", brokerName: "Tainá", fromStatus: "under_analysis", toStatus: "converted", actorType: "broker" },
        { leadId: "b", brokerId: "t", brokerName: "Tainá", fromStatus: "under_analysis", toStatus: "lost", actorType: "director" },
        { leadId: "c", brokerId: "n", brokerName: "Nayara", fromStatus: "under_analysis", toStatus: "negotiation", actorType: "broker" },
        { leadId: "d", brokerId: "n", brokerName: "Nayara", fromStatus: "under_analysis", toStatus: "awaiting_reply", actorType: "rule" },
        { leadId: "d", brokerId: "n", brokerName: "Nayara", fromStatus: "awaiting_reply", toStatus: "under_analysis", actorType: "system" },
      ],
      openLeads: [
        { brokerId: "n", brokerName: "Nayara", pending: true },
        { brokerId: "n", brokerName: "Nayara", pending: false },
        { brokerId: null, brokerName: null, pending: true },
      ],
    });
    expect(summary).toMatchObject({ entered: 1, converted: 1, lost: 1, returned: 1, pendingNow: 2, inClosingNow: 3 });
    expect(summary.brokers.map((row) => row.brokerName)).toEqual(["Nayara", "Sem corretor", "Tainá"]);
    expect(summary.brokers[0]).toMatchObject({ inClosing: 2, pending: 1, returned: 1, converted: 0 });
    expect(summary.brokers[2]).toMatchObject({ converted: 1, lost: 1, inClosing: 0 });
  });
});
