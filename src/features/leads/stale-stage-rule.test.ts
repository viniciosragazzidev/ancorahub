import { describe, expect, it } from "vitest";

import { recentlyUndoneAiMove } from "@/features/conversation-intelligence/ai-move";

import { isStageRegression, stageActorType } from "./stage-history-core";
import { businessDaysBetween, decideStaleStage, parseStaleStageMode, STALE_RULE } from "./stale-stage-rule";
import { LEAD_STATUS_ORDER, VALID_TRANSITIONS } from "./lead-status-constants";

// Quarta, 04/11/2026, 15h em São Paulo.
const WED = new Date("2026-11-04T18:00:00Z");
const day = (iso: string) => new Date(`${iso}T15:00:00Z`);
const base = { lastHumanStageChangeAt: null, holdUntil: null, potentialSale: false };

describe("dias úteis", () => {
  it("conta segunda a sexta, sem o dia de partida", () => {
    expect(businessDaysBetween(day("2026-11-04"), day("2026-11-04"))).toBe(0);
    expect(businessDaysBetween(day("2026-11-04"), day("2026-11-05"))).toBe(1);
    // Quarta → quarta seguinte: 5 dias úteis (qui, sex, seg, ter, qua).
    expect(businessDaysBetween(day("2026-11-04"), day("2026-11-11"))).toBe(5);
    // Sexta → segunda: 1.
    expect(businessDaysBetween(day("2026-11-06"), day("2026-11-09"))).toBe(1);
  });
});

describe("regra de chat parado", () => {
  it("5 dias úteis sem o cliente responder: vai para Aguardando retorno", () => {
    expect(decideStaleStage({ ...base, status: "quote_sent", lastCustomerMessageAt: day("2026-10-28"), stageEnteredAt: day("2026-10-20"), now: WED }))
      .toEqual({ action: "to_awaiting", silentBusinessDays: 5 });
    expect(decideStaleStage({ ...base, status: "negotiation", lastCustomerMessageAt: day("2026-10-29"), stageEnteredAt: day("2026-10-20"), now: WED }))
      .toEqual({ action: "none" });
  });

  it("sem nenhuma mensagem do cliente, conta desde que entrou na etapa", () => {
    expect(decideStaleStage({ ...base, status: "quote_sent", lastCustomerMessageAt: null, stageEnteredAt: day("2026-10-27"), now: WED }).action).toBe("to_awaiting");
  });

  it("etapas iniciais, de fechamento e fechadas não são mexidas", () => {
    for (const status of ["new", "distributed", "in_contact", "documentation_pending", "under_analysis", "converted", "lost"]) {
      expect(decideStaleStage({ ...base, status, lastCustomerMessageAt: null, stageEnteredAt: day("2026-09-01"), now: WED })).toEqual({ action: "none" });
    }
  });

  it("'Manter na etapa' e mudança humana recente seguram a regra", () => {
    const old = { status: "negotiation", lastCustomerMessageAt: day("2026-10-01"), stageEnteredAt: day("2026-10-01"), now: WED };
    expect(decideStaleStage({ ...base, ...old, holdUntil: day("2026-11-08") })).toEqual({ action: "none" });
    expect(decideStaleStage({ ...base, ...old, lastHumanStageChangeAt: day("2026-11-03") })).toEqual({ action: "none" });
    expect(decideStaleStage({ ...base, ...old, lastHumanStageChangeAt: day("2026-10-25") }).action).toBe("to_awaiting");
  });

  it("em Aguardando retorno: avisa 2 dias úteis antes e perde no 10º", () => {
    const awaiting = { ...base, status: "awaiting_reply", lastCustomerMessageAt: day("2026-10-01") };
    // Entrou em 23/10 (sex): até 04/11 são 8 dias úteis → faltam 2.
    expect(decideStaleStage({ ...awaiting, stageEnteredAt: day("2026-10-23"), now: WED })).toEqual({ action: "warn_lost", businessDaysLeft: 2 });
    // Entrou em 21/10 (qua): 10 dias úteis → Perdido.
    expect(decideStaleStage({ ...awaiting, stageEnteredAt: day("2026-10-21"), now: WED })).toEqual({ action: "to_lost", awaitingBusinessDays: 10 });
    expect(decideStaleStage({ ...awaiting, stageEnteredAt: day("2026-10-30"), now: WED })).toEqual({ action: "none" });
  });

  it("venda em potencial nunca perde sozinha", () => {
    const awaiting = { ...base, status: "awaiting_reply", lastCustomerMessageAt: day("2026-10-01"), potentialSale: true };
    expect(decideStaleStage({ ...awaiting, stageEnteredAt: day("2026-10-21"), now: WED })).toEqual({ action: "potential_sale_hold", awaitingBusinessDays: 10 });
    expect(decideStaleStage({ ...awaiting, stageEnteredAt: day("2026-10-23"), now: WED })).toEqual({ action: "none" });
  });

  it("cliente respondeu depois de ir para Aguardando retorno: volta", () => {
    expect(decideStaleStage({ ...base, status: "awaiting_reply", lastCustomerMessageAt: day("2026-11-03"), stageEnteredAt: day("2026-11-02"), now: WED }))
      .toEqual({ action: "restore" });
  });

  it("toda empresa começa em simulação", () => {
    expect(parseStaleStageMode(null)).toBe("simulate");
    expect(parseStaleStageMode("on")).toBe("on");
    expect(parseStaleStageMode("lixo")).toBe("simulate");
    expect(STALE_RULE.toAwaitingBusinessDays).toBe(5);
    expect(STALE_RULE.toLostBusinessDays).toBe(10);
  });
});

describe("etapa Aguardando retorno no funil", () => {
  it("sai para qualquer etapa ativa ou Perdido, e toda etapa ativa pode ir para ela", () => {
    expect(VALID_TRANSITIONS.awaiting_reply).toEqual(expect.arrayContaining(["negotiation", "documentation_pending", "under_analysis", "lost"]));
    for (const status of ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]) {
      expect(VALID_TRANSITIONS[status]).toContain("awaiting_reply");
    }
  });

  it("sair de Aguardando retorno não é recuo; perder é", () => {
    expect(isStageRegression({ previousStatus: "awaiting_reply", newStatus: "in_contact", order: LEAD_STATUS_ORDER })).toBe(false);
    expect(isStageRegression({ previousStatus: "awaiting_reply", newStatus: "lost", order: LEAD_STATUS_ORDER })).toBe(true);
    expect(isStageRegression({ previousStatus: "negotiation", newStatus: "in_contact", order: LEAD_STATUS_ORDER })).toBe(true);
  });

  it("quem mudou a etapa, para o histórico", () => {
    expect(stageActorType({ role: "broker" })).toBe("broker");
    expect(stageActorType({ role: "director", systemActor: "rule" })).toBe("rule");
    expect(stageActorType({ role: "marketing" })).toBe("system");
  });
});

describe("IA respeita o Desfazer do corretor", () => {
  it("por 7 dias depois de desfazer, a IA não move sozinha", () => {
    const now = new Date("2026-11-05T12:00:00Z");
    expect(recentlyUndoneAiMove({ fromStatus: "negotiation", toStatus: "under_analysis", at: "2026-11-01T10:00:00Z", confidence: 0.9, undoneAt: "2026-11-02T10:00:00Z" }, now)).toBe(true);
    expect(recentlyUndoneAiMove({ fromStatus: "negotiation", toStatus: "under_analysis", at: "2026-10-20T10:00:00Z", confidence: 0.9, undoneAt: "2026-10-21T10:00:00Z" }, now)).toBe(false);
    expect(recentlyUndoneAiMove({ fromStatus: "negotiation", toStatus: "under_analysis", at: "2026-11-01T10:00:00Z", confidence: 0.9 }, now)).toBe(false);
  });
});
