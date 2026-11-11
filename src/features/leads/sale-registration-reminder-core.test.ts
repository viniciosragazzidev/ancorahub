import { describe, expect, it } from "vitest";

import { isSaleReminderHour, saleReminderDue, saleReminderKey, saleReminderNotice } from "./sale-registration-reminder-core";
import { directorSaleAlertKey, directorSaleSummary, closingDirectorAlertVariables } from "./closing-director-alert-core";
import { builtInNoticeVariants } from "@/features/team-notices/variants";
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

describe("retorno de venda para a direção", () => {
  it("chave própria por tipo de venda, separada do aviso de fechamento", () => {
    expect(directorSaleAlertKey("sale_detected", "lead-1", "5521999990000")).toBe("lead-sale-director:sale_detected:lead-1:5521999990000");
  });

  it("resumo com motivo e trecho quando a IA viu a venda", () => {
    const summary = directorSaleSummary({ kind: "sale_detected", reason: "Venda detectada pela IA: adesão paga", evidence: ["paguei a adesão"], conversationSummary: null });
    expect(summary).toBe('Venda detectada pela IA: adesão paga. Trecho: "paguei a adesão". O corretor foi parabenizado e lembrado de registrar a venda.');
    expect(directorSaleSummary({ kind: "sale_registered" })).toBe("O corretor concluiu o Registrar venda no CRM.");
  });

  it("o texto do número da empresa sai com título de venda", () => {
    const variables = closingDirectorAlertVariables({ leadId: "lead-1", leadName: "Andrea", leadPhone: "21999990000", leadType: "PF", livesCount: 1, monthlyValue: null, planName: null, brokerName: "Carlos Eduardo", stage: "sale_detected", summary: "Resumo" });
    expect(variables[4]).toBe("Venda fechada (vista pela IA na conversa)");
    const texts = builtInNoticeVariants({ purpose: "leadClosingDirectorAlert", lead: "Andrea", phone: variables[1]!, deal: variables[2]!, broker: "Carlos Eduardo", stage: variables[4]!, summary: "Resumo", link: null }, 10);
    expect(texts.every((text) => !text.includes("fechamento"))).toBe(true);
    expect(texts[0]).toContain("Venda fechada");
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
