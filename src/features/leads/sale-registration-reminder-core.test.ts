import { describe, expect, it } from "vitest";

import { isSaleReminderHour, saleReminderDue, saleReminderKey, saleReminderNotice } from "./sale-registration-reminder-core";
import { evaluateAssessmentPolicy } from "@/features/conversation-intelligence/policy-executor";
import { conversationIntelligenceDomainRoot } from "@/shared/domain-root/conversation-intelligence-root";

const DAY = 24 * 60 * 60_000;
const convertedAt = new Date("2026-11-11T16:20:00.000Z");

describe("lembrete de registrar a venda", () => {
  it("vence 1, 3 e 5 dias depois da conversão e para no terceiro", () => {
    expect(saleReminderDue(convertedAt, 0, new Date(convertedAt.getTime() + 20 * 60 * 60_000))).toBeNull();
    expect(saleReminderDue(convertedAt, 0, new Date(convertedAt.getTime() + DAY))).toBe(1);
    expect(saleReminderDue(convertedAt, 1, new Date(convertedAt.getTime() + 2 * DAY))).toBeNull();
    expect(saleReminderDue(convertedAt, 1, new Date(convertedAt.getTime() + 3 * DAY))).toBe(2);
    expect(saleReminderDue(convertedAt, 2, new Date(convertedAt.getTime() + 5 * DAY))).toBe(3);
    expect(saleReminderDue(convertedAt, 3, new Date(convertedAt.getTime() + 9 * DAY))).toBeNull();
  });

  it("uma chave por lead e lembrete", () => {
    expect(saleReminderKey("lead-1", 2)).toBe("lead-sale-reminder:lead-1:2");
  });

  it("só em horário comercial de São Paulo", () => {
    expect(isSaleReminderHour(new Date("2026-11-12T12:00:00.000Z"))).toBe(true); // 9h
    expect(isSaleReminderHour(new Date("2026-11-12T11:59:00.000Z"))).toBe(false); // 8h59
    expect(isSaleReminderHour(new Date("2026-11-12T22:00:00.000Z"))).toBe(false); // 19h
  });

  it("lista o que falta e avisa o último lembrete", () => {
    const first = saleReminderNotice("Andrea", 1, ["valor", "vidas"]);
    expect(first.title).toBe("Registre a venda de Andrea");
    expect(first.message).toContain("Falta no CRM: valor, vidas.");
    expect(first.message).not.toContain("último");
    expect(saleReminderNotice("Andrea", 3).message).toContain("Este é o último lembrete.");
  });
});

describe("IA depois da venda", () => {
  it("não sugere mudança de etapa em lead convertido", () => {
    const result = evaluateAssessmentPolicy({
      assessment: {
        conversationStage: "CLOSING", customerIntent: "HIGH", engagement: "HIGH", sentiment: "POSITIVE", objections: [], buyingSignals: [],
        pendingFrom: "BROKER", nextBestAction: "COLLECT_DOCUMENTS", suggestedLeadStatus: "documentation_pending", statusConfidence: 0.95,
        statusReason: "Faltam documentos", summary: "Venda fechada, faltam documentos.", risk: null, opportunity: null, facts: [], inferences: [], evidence: [],
      } as never,
      currentLeadStatus: "converted",
      customerMessageCount: 5,
      brokerMessageCount: 5,
      config: conversationIntelligenceDomainRoot.defaults,
    });
    expect(result).toMatchObject({ action: "INSIGHT_ONLY", transitionAllowed: false, targetStatus: null });
  });
});
