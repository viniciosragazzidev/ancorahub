import { describe, expect, it } from "vitest";
import {
  ConversationAssessmentSchema,
  buildConversationIntelligenceContext,
  evaluateAssessmentPolicy,
  type ConversationAssessment,
} from "./index";
import { conversationIntelligenceDomainRoot } from "@/shared/domain-root/conversation-intelligence-root";

describe("Conversation Intelligence Engine (Etapa IA.1)", () => {
  const sampleAssessment: ConversationAssessment = {
    conversationStage: "NEGOTIATION",
    customerIntent: "HIGH",
    engagement: "HIGH",
    sentiment: "POSITIVE",
    objections: ["PRICE"],
    buyingSignals: ["ASKED_PAYMENT_METHOD", "ASKED_START_DATE"],
    pendingFrom: "BROKER",
    nextBestAction: "SEND_REVISED_QUOTE",
    suggestedLeadStatus: "negotiation",
    statusConfidence: 0.94,
    summary: "Cliente demonstrou interesse e pediu nova condição de preço.",
    risk: null,
    opportunity: "Cliente tem 4 vidas e fechamento previsto para este mês",
    facts: ["Cliente solicitou desconto na SulAmérica"],
    inferences: ["Alta propensão a fechar se houver flexibilidade de preço"],
  };

  describe("Schema & Type Contract", () => {
    it("validates valid structured output from AI", () => {
      const parsed = ConversationAssessmentSchema.safeParse(sampleAssessment);
      expect(parsed.success).toBe(true);
    });

    it("rejects invalid confidence outside [0, 1]", () => {
      const invalid = { ...sampleAssessment, statusConfidence: 1.5 };
      const parsed = ConversationAssessmentSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("Domain Root & Invariants", () => {
    it("Root definition has contract version 1 and safe defaults", () => {
      expect(conversationIntelligenceDomainRoot.key).toBe("conversation-intelligence");
      expect(conversationIntelligenceDomainRoot.contractVersion).toBe(1);
      expect(conversationIntelligenceDomainRoot.defaults.confidenceThresholdAuto).toBe(0.90);
      expect(conversationIntelligenceDomainRoot.defaults.confidenceThresholdSuggest).toBe(0.70);
    });

    it("Invariant CONVERTED_NEVER_AUTO prevents automated conversion by AI", () => {
      const validConfig = { ...conversationIntelligenceDomainRoot.defaults };
      const result = conversationIntelligenceDomainRoot.validate(validConfig);
      expect(result.valid).toBe(true);

      const illegalConfig = {
        ...conversationIntelligenceDomainRoot.defaults,
        autoAllowedTransitions: ["negotiation->converted"],
      };
      const illegalResult = conversationIntelligenceDomainRoot.validate(illegalConfig);
      expect(illegalResult.valid).toBe(false);
      expect(illegalResult.issues.some((i) => i.includes("converted"))).toBe(true);
    });
  });

  describe("Context Builder (Token Optimization)", () => {
    it("assembles compact context with memory and limited recent transcript", () => {
      const context = buildConversationIntelligenceContext({
        lead: {
          id: "lead-123",
          nome: "Maria Silva",
          status: "quote_sent",
          tipoPlano: "PME",
          vidas: 4,
          operadoraDesejada: "Amil",
        },
        previousMemory: {
          summary: "Cotação enviada há 2 dias",
          facts: ["Cliente quer plano com coparticipação reduzida"],
          objections: ["Preço"],
        },
        recentMessages: [
          { id: "m1", sender: "broker", content: "Segue a cotação Amil 4 vidas", timestamp: new Date() },
          { id: "m2", sender: "customer", content: "Consigo algum desconto se fechar hoje?", timestamp: new Date() },
          { id: "m3", sender: "broker", content: "Vou verificar com a diretoria", timestamp: new Date() },
        ],
        maxRecentMessages: 5,
      });

      expect(context.leadSummary).toContain("Maria Silva");
      expect(context.leadSummary).toContain("PME");
      expect(context.historicalMemory).toContain("coparticipação reduzida");
      expect(context.recentTranscript).toContain("Consigo algum desconto");
      expect(context.messageCount).toBe(3);
    });
  });

  describe("Policy Executor & Safe Transitions", () => {
    const config = conversationIntelligenceDomainRoot.defaults;

    it("executes AUTO_TRANSITION when confidence >= 0.90 and transition is auto-allowed", () => {
      const result = evaluateAssessmentPolicy({
        assessment: {
          ...sampleAssessment,
          suggestedLeadStatus: "negotiation",
          statusConfidence: 0.94,
        },
        currentLeadStatus: "quote_sent",
        config,
      });

      expect(result.action).toBe("AUTO_TRANSITION");
      expect(result.transitionAllowed).toBe(true);
      expect(result.targetStatus).toBe("negotiation");
      expect(result.aiFeedbackPayload?.source).toBe("AI");
    });

    it("returns SUGGEST when confidence is in middle range (0.70 to 0.89)", () => {
      const result = evaluateAssessmentPolicy({
        assessment: {
          ...sampleAssessment,
          suggestedLeadStatus: "negotiation",
          statusConfidence: 0.78,
        },
        currentLeadStatus: "quote_sent",
        config,
      });

      expect(result.action).toBe("SUGGEST");
      expect(result.transitionAllowed).toBe(false);
      expect(result.targetStatus).toBe("negotiation");
    });

    it("returns INSIGHT_ONLY when confidence < 0.70", () => {
      const result = evaluateAssessmentPolicy({
        assessment: {
          ...sampleAssessment,
          suggestedLeadStatus: "negotiation",
          statusConfidence: 0.55,
        },
        currentLeadStatus: "quote_sent",
        config,
      });

      expect(result.action).toBe("INSIGHT_ONLY");
      expect(result.transitionAllowed).toBe(false);
    });

    it("strictly blocks transition to 'converted' even with 0.99 confidence (SYSTEM_ONLY)", () => {
      const result = evaluateAssessmentPolicy({
        assessment: {
          ...sampleAssessment,
          suggestedLeadStatus: "converted",
          statusConfidence: 0.99,
        },
        currentLeadStatus: "negotiation",
        config,
      });

      expect(result.action).toBe("INSIGHT_ONLY");
      expect(result.transitionAllowed).toBe(false);
      expect(result.reason).toContain("SYSTEM_ONLY");
    });

    it("keeps transition to 'lost' as SUGGEST_ONLY even with 0.95 confidence", () => {
      const result = evaluateAssessmentPolicy({
        assessment: {
          ...sampleAssessment,
          suggestedLeadStatus: "lost",
          statusConfidence: 0.95,
        },
        currentLeadStatus: "in_contact",
        config,
      });

      expect(result.action).toBe("SUGGEST");
      expect(result.transitionAllowed).toBe(false);
      expect(result.reason).toContain("SUGGEST_ONLY");
    });
  });
});
