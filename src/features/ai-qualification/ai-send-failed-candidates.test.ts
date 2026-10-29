import { describe, expect, it } from "vitest";

import {
  AI_RESTART_SKIP_LABEL,
  AI_SEND_FAILED_SKIP_LABEL,
  decideAiRestartDispatch,
  decideAiSendFailedCandidate,
  type AiSendFailedLeadFacts,
} from "./ai-send-failed-candidates";

const now = new Date("2026-10-28T15:00:00.000Z");
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

const failedLead: AiSendFailedLeadFacts = {
  leadId: "lead-1",
  status: "new",
  corretorId: null,
  qualificationStatus: "pending",
  lastAiSentAt: hoursAgo(2),
  lastAiFailed: true,
  deliveredAfterLastAi: false,
  lastCustomerInboundAt: hoursAgo(3),
};

describe("candidatos a reabrir quando a mensagem da IA falhou", () => {
  it("aceita o lead sem corretor cuja última mensagem da IA falhou e que escreveu nas últimas 24 h", () => {
    const decision = decideAiSendFailedCandidate(failedLead, now);
    expect(decision).toEqual({
      eligible: true,
      failedAt: hoursAgo(2),
      windowEndsAt: new Date(hoursAgo(3).getTime() + 24 * 60 * 60 * 1000),
    });
  });

  it("aceita um lead desqualificado pela falha (qualificação não está mais em andamento)", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, qualificationStatus: "disqualified" }, now).eligible).toBe(true);
  });

  it("não reabre lead com corretor", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, corretorId: "broker-1" }, now)).toEqual({ eligible: false, reason: "has_broker" });
  });

  it("não reabre lead convertido, perdido ou já distribuído", () => {
    for (const status of ["converted", "lost", "distributed"]) {
      expect(decideAiSendFailedCandidate({ ...failedLead, status }, now)).toEqual({ eligible: false, reason: "closed_status" });
    }
  });

  it("não reabre quando a última mensagem da IA não falhou", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, lastAiFailed: false }, now)).toEqual({ eligible: false, reason: "no_failed_ai_message" });
    expect(decideAiSendFailedCandidate({ ...failedLead, lastAiSentAt: null }, now)).toEqual({ eligible: false, reason: "no_failed_ai_message" });
  });

  it("não reabre quando já houve um envio entregue depois da falha", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, deliveredAfterLastAi: true }, now)).toEqual({ eligible: false, reason: "delivered_after_failure" });
  });

  it("não lista lead sem mensagem do cliente: só um modelo aprovado resolveria", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, lastCustomerInboundAt: null }, now)).toEqual({ eligible: false, reason: "no_customer_message" });
  });

  it("não lista quando a janela de 24 h já fechou", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, lastCustomerInboundAt: hoursAgo(25) }, now)).toEqual({ eligible: false, reason: "window_closed" });
    // Exactly 24 h is closed.
    expect(decideAiSendFailedCandidate({ ...failedLead, lastCustomerInboundAt: hoursAgo(24) }, now)).toEqual({ eligible: false, reason: "window_closed" });
  });

  it("não reabre de novo um lead que já está em qualificação (reexecução idempotente)", () => {
    expect(decideAiSendFailedCandidate({ ...failedLead, qualificationStatus: "qualifying" }, now)).toEqual({ eligible: false, reason: "already_qualifying" });
  });

  it("tem um motivo legível para cada recusa", () => {
    expect(Object.keys(AI_SEND_FAILED_SKIP_LABEL)).toHaveLength(7);
    for (const label of Object.values(AI_SEND_FAILED_SKIP_LABEL)) {
      expect(label.length).toBeGreaterThan(5);
      expect(label).not.toMatch(/[—–]/);
    }
  });
});

describe("disparo da primeira mensagem da IA depois da reabertura", () => {
  const windowEndsAt = new Date("2026-10-28T20:00:00.000Z");

  it("dispara dentro da janela, sem envio entregue depois da falha", () => {
    expect(decideAiRestartDispatch({ windowEndsAt, now: new Date("2026-10-28T19:00:00.000Z"), deliveredAfterLastAi: false })).toEqual({ send: true });
  });

  it("não dispara quando a janela já fechou (no instante do fim também)", () => {
    expect(decideAiRestartDispatch({ windowEndsAt, now: new Date("2026-10-28T20:01:00.000Z"), deliveredAfterLastAi: false }))
      .toEqual({ send: false, reason: "window_closed" });
    expect(decideAiRestartDispatch({ windowEndsAt, now: windowEndsAt, deliveredAfterLastAi: false }))
      .toEqual({ send: false, reason: "window_closed" });
  });

  it("não dispara de novo quando já houve envio entregue depois da falha", () => {
    expect(decideAiRestartDispatch({ windowEndsAt, now: new Date("2026-10-28T19:00:00.000Z"), deliveredAfterLastAi: true }))
      .toEqual({ send: false, reason: "already_delivered" });
  });

  it("tem motivo legível para cada recusa do disparo", () => {
    expect(Object.keys(AI_RESTART_SKIP_LABEL)).toEqual(["window_closed", "already_delivered"]);
    for (const label of Object.values(AI_RESTART_SKIP_LABEL)) expect(label).not.toMatch(/[—–]/);
  });
});
