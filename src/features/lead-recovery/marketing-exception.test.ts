import { describe, expect, it } from "vitest";

import { decideRecoveryTouch, type RecoveryCadenceInput } from "./cadence-rules";
import { isRecoveryMarketingTemplate, recoveryMarketingAllowed, recoveryUsableTemplates } from "./marketing-exception";
import { decideNurtureTouch, NURTURE_TEMPLATE } from "./nurture-rules";
import { isRecoveryControl, parseRecoverySettings } from "./settings-core";

const on = parseRecoverySettings(JSON.stringify({ enabled: true, stoppedMidway: true, nurture: true, callQueue: true, legalReviewedAt: "2026-11-21T12:00:00Z" }));
const marketing = new Set(["anc_t2_beneficio", "anc_s4_cotacao", "anc_s5_ligacao", "anc_s6_despedida", "anc_n_reajuste", "promo_black_friday"]);
const utility = new Set(["anc_t0_assistente", "anc_t1_lembrete"]);

describe("exceção da DEC-155 para a recuperação (DEC-190)", () => {
  it("só vale com a recuperação ligada e a conferência jurídica registrada", () => {
    expect(recoveryMarketingAllowed(on)).toBe(true);
    expect(recoveryMarketingAllowed(parseRecoverySettings(null))).toBe(false);
    expect(recoveryMarketingAllowed({ ...on, legalReviewedAt: null })).toBe(false);
    expect(recoveryMarketingAllowed({ ...on, enabled: false })).toBe(false);
  });

  it("libera só os Marketing da lista de recuperação; outro Marketing segue de fora", () => {
    const usable = recoveryUsableTemplates({ utility, marketing, allowed: true });
    expect([...usable].sort()).toEqual(["anc_n_reajuste", "anc_s4_cotacao", "anc_s5_ligacao", "anc_s6_despedida", "anc_t0_assistente", "anc_t1_lembrete", "anc_t2_beneficio"]);
    expect(usable.has("promo_black_friday")).toBe(false);
  });

  it("sem a exceção, continua só Utility", () => {
    expect([...recoveryUsableTemplates({ utility, marketing, allowed: false })].sort()).toEqual(["anc_t0_assistente", "anc_t1_lembrete"]);
  });

  it("o 1º contato e o T1 nunca viram Marketing, mesmo com a exceção", () => {
    expect(isRecoveryMarketingTemplate("anc_t1_lembrete", "MARKETING", true)).toBe(false);
    expect(isRecoveryMarketingTemplate("anc_t0_assistente", "MARKETING", true)).toBe(false);
    expect(isRecoveryMarketingTemplate("anc_s4_cotacao", "MARKETING", true)).toBe(true);
    expect(isRecoveryMarketingTemplate("anc_s4_cotacao", "MARKETING", false)).toBe(false);
  });
});

// Quinta-feira, 19/11/2026, 14:00 em São Paulo; S4 vencido (D+2), S2 e S3 já enviados.
const now = new Date("2026-11-19T17:00:00Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60_000);
const leadId = Array.from({ length: 50 }, (_, index) => `mkt-${index}`).find((id) => !isRecoveryControl(id, 10))!;
const usable = recoveryUsableTemplates({ utility, marketing, allowed: recoveryMarketingAllowed(on) });

function s4(partial: Partial<RecoveryCadenceInput> = {}): RecoveryCadenceInput {
  return {
    now, settings: on, segment: "stopped_midway", leadId,
    lead: { status: "new", qualificationStatus: "cold", corretorId: null, firstContactAt: null, recoveryState: null },
    conversation: { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: null, wrongNumberAt: null },
    startAt: ago(2 * 24 * 60 + 30), lastInboundAt: ago(2 * 24 * 60 + 40), lastMetaInboundAt: ago(2 * 24 * 60 + 40),
    conversationChannel: "meta", wahaAvailable: false,
    touches: ["s1", "s2", "s3"].map((step) => ({ step, status: "sent", attempt: 1, errorCode: null, at: ago(3000) })),
    automaticSentSinceStart: 3, lastAutomaticAt: ago(3000), approvedTemplates: usable, marketingTemplates: marketing,
    ...partial,
  };
}

describe("passo de Marketing liberado: quando sai e quando continua não saindo", () => {
  it("S4 aprovado como Marketing agora sai pela Meta", () => {
    expect(decideRecoveryTouch(s4())).toMatchObject({ action: "send", step: { id: "s4", template: "anc_s4_cotacao" }, channel: "meta" });
  });

  it("sem a exceção (conferência jurídica ausente) nada sai", () => {
    expect(decideRecoveryTouch(s4({ settings: { ...on, legalReviewedAt: null } }))).toEqual({ action: "stop", reason: "legal_pending" });
  });

  it("pediu SAIR (opt-out): não sai", () => {
    expect(decideRecoveryTouch(s4({ conversation: { status: "WAITING_CUSTOMER", automationState: "AI_ACTIVE", optOutAt: ago(30), wrongNumberAt: null } }))).toEqual({ action: "stop", reason: "opted_out" });
  });

  it("131049: espera 24 h e para no segundo", () => {
    const limit = { step: "s4", status: "failed", attempt: 1, errorCode: "131049", at: ago(60) };
    expect(decideRecoveryTouch(s4({ touches: [...s4().touches, limit] }))).toEqual({ action: "wait", reason: "meta_limit_cooldown" });
    expect(decideRecoveryTouch(s4({ touches: [...s4().touches, limit, { ...limit, at: ago(2000) }] }))).toEqual({ action: "stop", reason: "meta_limit" });
  });

  it("domingo sem o cliente ter escrito no domingo: espera", () => {
    const sunday = new Date("2026-11-22T15:00:00Z");
    expect(decideRecoveryTouch(s4({ now: sunday, startAt: new Date(sunday.getTime() - (2 * 24 * 60 + 30) * 60_000) }))).toEqual({ action: "wait", reason: "outside_hours" });
  });

  it("já com 6 mensagens automáticas: não sai, vai para a fila de ligação", () => {
    expect(decideRecoveryTouch(s4({ automaticSentSinceStart: 6 }))).toEqual({ action: "finished", next: "call_queue" });
  });

  it("grupo de controle: não sai", () => {
    const control = Array.from({ length: 300 }, (_, index) => `mkt-${index}`).find((id) => isRecoveryControl(id, 10))!;
    expect(decideRecoveryTouch(s4({ leadId: control }))).toEqual({ action: "stop", reason: "control" });
  });

  it("Marketing fora da lista continua barrado", () => {
    expect(decideRecoveryTouch(s4({ approvedTemplates: recoveryUsableTemplates({ utility, marketing: new Set(["promo_black_friday"]), allowed: true }), marketingTemplates: new Set(["anc_s4_cotacao"]) }))).toMatchObject({ action: "skip", reason: "marketing_blocked" });
  });

  it("nutrição com Marketing liberado sai; com opt-out ou controle, não", () => {
    const base = { now, settings: on, leadId, nurture: { state: "nurture" as const, at: ago(31 * 24 * 60), until: ago(60), touches: 0 }, lastInboundAt: ago(40 * 24 * 60), optedOut: false, hasBroker: false, approvedTemplates: usable, marketingTemplates: marketing };
    expect(decideNurtureTouch(base)).toEqual({ action: "send", step: "n1", template: NURTURE_TEMPLATE });
    expect(decideNurtureTouch({ ...base, optedOut: true })).toEqual({ action: "stop", reason: "opted_out" });
    const control = Array.from({ length: 300 }, (_, index) => `mkt-${index}`).find((id) => isRecoveryControl(id, 10))!;
    expect(decideNurtureTouch({ ...base, leadId: control })).toEqual({ action: "stop", reason: "control" });
  });
});
