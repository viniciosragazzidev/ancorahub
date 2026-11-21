import { describe, expect, it } from "vitest";

import { recoverListOf } from "@/features/sasa/command-core";
import { classifySasaText } from "@/features/sasa/intent-rules";

import { buildRecoveryText } from "./cadence-rules";
import { decideNurtureTouch, lostGoesToNurture, NURTURE_TEMPLATE } from "./nurture-rules";
import { isRecoveryControl, parseRecoverySettings } from "./settings-core";
import { stepVariantText } from "./step-experiments";

// Quinta-feira, 19/11/2026, 14:00 em São Paulo.
const now = new Date("2026-11-19T17:00:00Z");
const days = (value: number) => new Date(now.getTime() - value * 86_400_000);
const on = parseRecoverySettings(JSON.stringify({ enabled: true, nurture: true, legalReviewedAt: "2026-11-21T12:00:00Z" }));
const leadId = Array.from({ length: 50 }, (_, index) => `nut-${index}`).find((id) => !isRecoveryControl(id, 10))!;
const base = { now, settings: on, leadId, nurture: { state: "nurture" as const, at: days(31), until: days(1), touches: 0 }, lastInboundAt: days(40), optedOut: false, hasBroker: false, approvedTemplates: new Set([NURTURE_TEMPLATE]) };

describe("nutrição", () => {
  it("desligada por padrão e travada sem a conferência jurídica", () => {
    expect(decideNurtureTouch({ ...base, settings: parseRecoverySettings(null) })).toEqual({ action: "stop", reason: "disabled" });
    expect(decideNurtureTouch({ ...base, settings: { ...on, legalReviewedAt: null } })).toEqual({ action: "stop", reason: "legal_pending" });
  });

  it("um toque por mês, no máximo 3", () => {
    expect(decideNurtureTouch(base)).toEqual({ action: "send", step: "n1", template: NURTURE_TEMPLATE });
    expect(decideNurtureTouch({ ...base, nurture: { ...base.nurture, until: new Date(now.getTime() + 86_400_000) } })).toEqual({ action: "wait", reason: "not_yet" });
    expect(decideNurtureTouch({ ...base, nurture: { ...base.nurture, touches: 3 } })).toEqual({ action: "finished" });
  });

  it("respondeu: sai da nutrição; opt-out e corretor param", () => {
    expect(decideNurtureTouch({ ...base, lastInboundAt: days(2) })).toEqual({ action: "replied" });
    expect(decideNurtureTouch({ ...base, optedOut: true })).toEqual({ action: "stop", reason: "opted_out" });
    expect(decideNurtureTouch({ ...base, hasBroker: true })).toEqual({ action: "stop", reason: "assigned" });
  });

  it("template não aprovado: pula e tenta no mês seguinte", () => {
    expect(decideNurtureTouch({ ...base, approvedTemplates: new Set() })).toEqual({ action: "skip", step: "n1", reason: "template_not_approved" });
  });

  it("perdido por preço ou momento volta depois de 60 dias; por outro motivo, não", () => {
    expect(lostGoesToNurture({ status: "lost", lossReason: "Achou caro", lostAt: days(61), now })).toBe(true);
    expect(lostGoesToNurture({ status: "lost", lossReason: "Agora não é o momento", lostAt: days(30), now })).toBe(false);
    expect(lostGoesToNurture({ status: "lost", lossReason: "Fechou com outro corretor", lostAt: days(90), now })).toBe(false);
  });
});

describe("A/B por passo", () => {
  it("as duas variantes do S2 têm a saída SAIR", () => {
    for (const variant of ["fechada", "aberta"] as const) {
      expect(stepVariantText("s2", variant, buildRecoveryText("s2", { leadName: "Ana" }), "Ana")).toContain("responda SAIR");
    }
    expect(stepVariantText("s2", "aberta", buildRecoveryText("s2", { leadName: "Ana" }), "Ana")).toContain("o que falta");
  });
});

describe("Sasá: quem recuperar hoje", () => {
  it("entende o pedido", () => {
    expect(classifySasaText("Quem eu recupero hoje?")).toEqual({ tool: "leads.recover" });
    expect(classifySasaText("tem lead parado?")).toEqual({ tool: "leads.recover" });
    expect(classifySasaText("quem está esperando resposta?")).toEqual({ tool: "leads.waiting" });
  });

  it("lista quem está parado sem retorno, negociação primeiro", () => {
    const list = recoverListOf([
      { id: "a", name: "Ana", status: "in_contact", arrivedAt: days(5) },
      { id: "b", name: "Bia", status: "negotiation", arrivedAt: days(2) },
      { id: "c", name: "Caio", status: "quote_sent", arrivedAt: days(9) },
      { id: "d", name: "Davi", status: "negotiation", arrivedAt: days(1) },
      { id: "e", name: "Eva", status: "converted", arrivedAt: days(1) },
    ], new Set(["d"]));
    expect(list.map((lead) => lead.leadId)).toEqual(["b", "c", "a"]);
  });
});
