import { describe, expect, it } from "vitest";

import { buildRecoveryText, decideRecoveryTouch, pendingAskFor, SAIR_FOOTER, type RecoveryCadenceInput } from "./cadence-rules";
import { isRecoveryControl, parseRecoverySettings } from "./settings-core";

// Quinta-feira, 19/11/2026, 14:00 em São Paulo.
const now = new Date("2026-11-19T17:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const on = parseRecoverySettings(JSON.stringify({ enabled: true, stoppedMidway: true, warmBridge: true, callQueue: true, legalReviewedAt: "2026-11-21T12:00:00Z" }));
// Um lead fora do grupo de controle de 10%.
const leadId = Array.from({ length: 50 }, (_, index) => `lead-${index}`).find((id) => !isRecoveryControl(id, 10))!;

function input(partial: Partial<RecoveryCadenceInput> = {}): RecoveryCadenceInput {
  return {
    now,
    settings: on,
    segment: "stopped_midway",
    leadId,
    lead: { status: "new", qualificationStatus: "cold", corretorId: null, firstContactAt: null, recoveryState: null },
    conversation: { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: null, wrongNumberAt: null },
    startAt: ago(200),
    lastInboundAt: ago(210),
    lastMetaInboundAt: ago(210),
    conversationChannel: "meta",
    wahaAvailable: false,
    touches: [{ step: "s1", status: "sent", attempt: 1, errorCode: null, at: ago(193) }],
    automaticSentSinceStart: 1,
    lastAutomaticAt: ago(193),
    approvedTemplates: new Set(["anc_s4_cotacao", "anc_s5_ligacao", "anc_s6_despedida"]),
    ...partial,
  };
}

describe("decideRecoveryTouch: não enviar", () => {
  it("desligado por padrão", () => {
    expect(decideRecoveryTouch(input({ settings: parseRecoverySettings(null) }))).toEqual({ action: "stop", reason: "disabled" });
  });

  it("sem conferência jurídica não sai nada", () => {
    expect(decideRecoveryTouch(input({ settings: { ...on, legalReviewedAt: null } }))).toEqual({ action: "stop", reason: "legal_pending" });
  });

  it("grupo de controle recebe só o que existe hoje", () => {
    const control = Array.from({ length: 300 }, (_, index) => `lead-${index}`).find((id) => isRecoveryControl(id, 10))!;
    expect(decideRecoveryTouch(input({ leadId: control }))).toEqual({ action: "stop", reason: "control" });
  });

  it("opt-out (SAIR), número errado ou Não contatar", () => {
    expect(decideRecoveryTouch(input({ conversation: { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: ago(5), wrongNumberAt: null } })).action).toBe("stop");
    expect(decideRecoveryTouch(input({ lead: { status: "new", qualificationStatus: "cold", corretorId: null, firstContactAt: null, recoveryState: "do_not_contact" } }))).toEqual({ action: "stop", reason: "opted_out" });
  });

  it("respondeu depois do silêncio: volta para a IA", () => {
    expect(decideRecoveryTouch(input({ lastInboundAt: ago(10) }))).toEqual({ action: "stop", reason: "replied" });
  });

  it("recebeu corretor, perdido ou pessoa no atendimento", () => {
    expect(decideRecoveryTouch(input({ lead: { status: "new", qualificationStatus: "cold", corretorId: "c1", firstContactAt: null, recoveryState: null } }))).toEqual({ action: "stop", reason: "assigned" });
    expect(decideRecoveryTouch(input({ lead: { status: "lost", qualificationStatus: "cold", corretorId: null, firstContactAt: null, recoveryState: null } }))).toEqual({ action: "stop", reason: "closed" });
    expect(decideRecoveryTouch(input({ conversation: { status: "HUMAN_ACTIVE", automationState: "PAUSED_HUMAN", optOutAt: null, wrongNumberAt: null } }))).toEqual({ action: "stop", reason: "human" });
  });

  it("131049: espera 24 h e para no segundo", () => {
    const first = { step: "s4", status: "failed", attempt: 1, errorCode: "131049", at: ago(60) };
    expect(decideRecoveryTouch(input({ startAt: ago(3 * 24 * 60), lastInboundAt: ago(3 * 24 * 60 + 10), touches: [first] }))).toEqual({ action: "wait", reason: "meta_limit_cooldown" });
    expect(decideRecoveryTouch(input({ touches: [first, { ...first, at: ago(2000) }] }))).toEqual({ action: "stop", reason: "meta_limit" });
  });

  it("antes da hora, fora do horário e sem intervalo mínimo", () => {
    expect(decideRecoveryTouch(input({ startAt: ago(100) }))).toEqual({ action: "wait", reason: "too_early" });
    expect(decideRecoveryTouch(input({ now: new Date("2026-11-19T23:30:00Z"), startAt: new Date("2026-11-19T19:00:00Z"), lastAutomaticAt: null, lastMetaInboundAt: new Date("2026-11-19T18:50:00Z"), lastInboundAt: new Date("2026-11-19T18:50:00Z") }))).toEqual({ action: "wait", reason: "outside_hours" });
    expect(decideRecoveryTouch(input({ lastAutomaticAt: ago(30) }))).toEqual({ action: "wait", reason: "gap" });
  });

  it("domingo só para quem escreveu no domingo", () => {
    const sunday = new Date("2026-11-22T15:00:00Z");
    const base = { now: sunday, startAt: new Date(sunday.getTime() - 200 * 60_000), lastAutomaticAt: null };
    expect(decideRecoveryTouch(input({ ...base, lastInboundAt: new Date("2026-11-21T18:00:00Z"), lastMetaInboundAt: new Date("2026-11-22T11:30:00Z") }))).toEqual({ action: "wait", reason: "outside_hours" });
    expect(decideRecoveryTouch(input({ ...base, lastInboundAt: new Date(sunday.getTime() - 210 * 60_000), lastMetaInboundAt: new Date(sunday.getTime() - 210 * 60_000) })).action).toBe("send");
  });

  it("texto livre com a janela da Meta fechada e sem WAHA: pula", () => {
    const decision = decideRecoveryTouch(input({ startAt: ago(21 * 60), lastInboundAt: ago(25 * 60), lastMetaInboundAt: ago(25 * 60), touches: [{ step: "s2", status: "sent", attempt: 1, errorCode: null, at: ago(17 * 60) }], automaticSentSinceStart: 2 }));
    expect(decision).toMatchObject({ action: "skip", reason: "window_closed" });
  });

  it("template não aprovado: pula o passo", () => {
    const decision = decideRecoveryTouch(input({ startAt: ago(2 * 24 * 60 + 30), lastInboundAt: ago(2 * 24 * 60 + 40), touches: ["s2", "s3"].map((step) => ({ step, status: "sent", attempt: 1, errorCode: null, at: ago(3000) })), automaticSentSinceStart: 3, approvedTemplates: new Set() }));
    expect(decision).toMatchObject({ action: "skip", reason: "template_not_approved" });
  });

  it("passo desligado na configuração: pula", () => {
    const settings = { ...on, steps: { ...on.steps, s2: { enabled: false, channel: "same" as const } } };
    expect(decideRecoveryTouch(input({ settings }))).toMatchObject({ action: "skip", reason: "step_disabled" });
  });

  it("regra dos 6 toques: vai para a fila de ligação", () => {
    expect(decideRecoveryTouch(input({ automaticSentSinceStart: 6 }))).toEqual({ action: "finished", next: "call_queue" });
    expect(decideRecoveryTouch(input({ automaticSentSinceStart: 6, settings: { ...on, callQueue: false } }))).toEqual({ action: "finished", next: null });
  });
});

describe("decideRecoveryTouch: enviar", () => {
  it("S2 três horas depois, pelo canal da conversa", () => {
    expect(decideRecoveryTouch(input())).toMatchObject({ action: "send", step: { id: "s2" }, channel: "meta", fallback: null, attempt: 1 });
  });

  it("canal mesmo da conversa cai para o outro quando o primeiro não vale", () => {
    expect(decideRecoveryTouch(input({ conversationChannel: "waha", wahaAvailable: false }))).toMatchObject({ action: "send", channel: "meta" });
    expect(decideRecoveryTouch(input({ conversationChannel: "waha", wahaAvailable: true }))).toMatchObject({ action: "send", channel: "waha", fallback: "meta" });
  });

  it("template S4 sempre pela Meta, mesmo com a conversa no WAHA", () => {
    const decision = decideRecoveryTouch(input({ startAt: ago(2 * 24 * 60 + 30), conversationChannel: "waha", wahaAvailable: true, touches: ["s2", "s3"].map((step) => ({ step, status: "sent", attempt: 1, errorCode: null, at: ago(3000) })), automaticSentSinceStart: 3, lastAutomaticAt: ago(3000), lastMetaInboundAt: ago(4000), lastInboundAt: ago(4000) }));
    expect(decision).toMatchObject({ action: "send", step: { id: "s4", kind: "template" }, channel: "meta", fallback: null });
  });

  it("morno sem 1º contato do corretor: ponte W2", () => {
    const decision = decideRecoveryTouch(input({ segment: "warm", lead: { status: "distributed", qualificationStatus: "warm", corretorId: "c1", firstContactAt: null, recoveryState: null }, startAt: ago(130), touches: [], automaticSentSinceStart: 0, lastAutomaticAt: null }));
    expect(decision).toMatchObject({ action: "send", step: { id: "w2" } });
  });
});

describe("textos", () => {
  it("toda mensagem tem a saída SAIR e nenhuma pergunta de saúde", () => {
    for (const step of ["s2", "s3", "w2", "w3"] as const) {
      const text = buildRecoveryText(step, { leadName: "ANDRÉIA DEIA", brokerName: "Vinicios Ragazzi", pendingAsk: pendingAskFor(["planType", "numberOfLives"]) });
      expect(text.endsWith(SAIR_FOOTER)).toBe(true);
      expect(text).not.toMatch(/doen|cirurg|saúde de|condição/i);
    }
    expect(buildRecoveryText("s2", { leadName: "ANDRÉIA DEIA", pendingAsk: pendingAskFor(["planType", "numberOfLives"]) })).toContain("Oi, Andréia! Pra eu seguir com a sua cotação, só falta a idade de quem vai usar o plano.");
  });
});
