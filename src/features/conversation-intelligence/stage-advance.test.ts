import { describe, expect, it } from "vitest";

import { conversationIntelligenceDomainRoot } from "@/shared/domain-root/conversation-intelligence-root";

import { analysisNews, evaluateAssessmentPolicy } from "./policy-executor";
import type { ConversationAssessment } from "./types";

const config = conversationIntelligenceDomainRoot.defaults;
const talked = { customerMessageCount: 3, brokerMessageCount: 4 };
const assessment = (suggestedLeadStatus: string, statusConfidence: number): ConversationAssessment => ({
  conversationStage: "NEGOTIATION",
  customerIntent: "HIGH",
  engagement: "HIGH",
  sentiment: "NEUTRAL",
  objections: [],
  buyingSignals: [],
  pendingFrom: "BROKER",
  nextBestAction: "Enviar o valor pedido para o beneficiário",
  suggestedLeadStatus,
  statusConfidence,
  statusReason: "A cliente já recebeu cotação e está comparando preços.",
  summary: "Cliente recebeu a cotação e pediu um valor específico para um dos beneficiários.",
  risk: null,
  opportunity: null,
  facts: [],
  inferences: [],
  evidence: [],
});

describe("stage advance by the conversation (28/10)", () => {
  it("moves the Magma case one stage: seen negotiating at 75% from Em contato, it reaches Cotação enviada", () => {
    const result = evaluateAssessmentPolicy({ assessment: assessment("negotiation", 0.75), currentLeadStatus: "in_contact", ...talked, config });
    expect(result.action).toBe("AUTO_TRANSITION");
    expect(result.targetStatus).toBe("quote_sent");
  });

  it("moves one stage from 75%", () => {
    const result = evaluateAssessmentPolicy({ assessment: assessment("negotiation", 0.75), currentLeadStatus: "quote_sent", ...talked, config });
    expect(result).toMatchObject({ action: "AUTO_TRANSITION", targetStatus: "negotiation" });
  });

  it("below 75% one stage is still a suggestion", () => {
    const result = evaluateAssessmentPolicy({ assessment: assessment("quote_sent", 0.72), currentLeadStatus: "in_contact", ...talked, config });
    expect(result).toMatchObject({ action: "SUGGEST", targetStatus: "quote_sent" });
  });

  it("skips stages only from 90%", () => {
    const result = evaluateAssessmentPolicy({ assessment: assessment("negotiation", 0.92), currentLeadStatus: "in_contact", ...talked, config });
    expect(result).toMatchObject({ action: "AUTO_TRANSITION", targetStatus: "negotiation" });
  });

  it("keeps the safeguards: no customer message, the company's suggest mode, and lost stay suggestions", () => {
    expect(evaluateAssessmentPolicy({ assessment: assessment("negotiation", 0.8), currentLeadStatus: "in_contact", customerMessageCount: 0, brokerMessageCount: 3, config }).action).toBe("SUGGEST");
    expect(evaluateAssessmentPolicy({ assessment: assessment("negotiation", 0.8), currentLeadStatus: "in_contact", ...talked, mode: "suggest", config }).action).toBe("SUGGEST");
    expect(evaluateAssessmentPolicy({ assessment: { ...assessment("lost", 0.95), lossReasonCode: "preco" }, currentLeadStatus: "negotiation", ...talked, config }).action).toBe("SUGGEST");
  });

  it("leaving Distribuído still needs the broker to have talked", () => {
    const result = evaluateAssessmentPolicy({ assessment: assessment("quote_sent", 0.8), currentLeadStatus: "distributed", customerMessageCount: 2, brokerMessageCount: 0, config });
    expect(result.action).toBe("SUGGEST");
  });
});

describe("what is new in an analysis", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  const base = { autoMoved: false, action: "INSIGHT_ONLY" as const, targetStatus: null, lastNoteAt: "2026-10-28T11:00:00Z", now };

  it("notifies and notes a move, a new suggestion and the first diagnosis", () => {
    expect(analysisNews({ ...base, autoMoved: true, action: "AUTO_TRANSITION", targetStatus: "quote_sent", previous: { action: "INSIGHT_ONLY" } })).toEqual({ notify: true, writeNote: true });
    expect(analysisNews({ ...base, action: "SUGGEST", targetStatus: "negotiation", previous: { action: "SUGGEST", targetStatus: "quote_sent" } })).toEqual({ notify: true, writeNote: true });
    expect(analysisNews({ ...base, previous: null })).toEqual({ notify: true, writeNote: true });
  });

  it("stays quiet when the same suggestion or a plain insight repeats", () => {
    expect(analysisNews({ ...base, action: "SUGGEST", targetStatus: "negotiation", previous: { action: "SUGGEST", targetStatus: "negotiation" } })).toEqual({ notify: false, writeNote: false });
    expect(analysisNews({ ...base, previous: { action: "INSIGHT_ONLY" } })).toEqual({ notify: false, writeNote: false });
  });

  it("writes the note again after 6 hours, without notifying", () => {
    expect(analysisNews({ ...base, lastNoteAt: "2026-10-28T05:59:00Z", previous: { action: "INSIGHT_ONLY" } })).toEqual({ notify: false, writeNote: true });
  });
});
