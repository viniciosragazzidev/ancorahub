import { describe, expect, it } from "vitest";
import {
  ConversationAssessmentSchema,
  buildConversationIntelligenceContext,
  evaluateAssessmentPolicy,
  type ConversationAssessment,
} from "./index";
import { isUsableAssessment } from "./policy-executor";
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
    statusReason: "Cliente pediu nova condição de preço sobre a cotação enviada.",
    summary: "Cliente demonstrou interesse e pediu nova condição de preço.",
    risk: null,
    opportunity: "Cliente tem 4 vidas e fechamento previsto para este mês",
    facts: ["Cliente solicitou desconto na SulAmérica"],
    inferences: ["Alta propensão a fechar se houver flexibilidade de preço"],
    evidence: [],
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
      expect(conversationIntelligenceDomainRoot.defaults.analysisDebounceSeconds).toBe(60);
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

    describe("automatic stage moves (decided 25/09)", () => {
      it("advances along the funnel by itself — cotação enviada, negociação, documentação, análise", () => {
        for (const [from, to] of [["in_contact", "quote_sent"], ["quote_sent", "negotiation"], ["negotiation", "documentation_pending"], ["documentation_pending", "under_analysis"], ["in_contact", "negotiation"]]) {
          const result = evaluateAssessmentPolicy({ assessment: { ...sampleAssessment, suggestedLeadStatus: to }, currentLeadStatus: from, config });
          expect(result.action, `${from}->${to}`).toBe("AUTO_TRANSITION");
        }
      });

      it("only suggests going back a stage", () => {
        const result = evaluateAssessmentPolicy({ assessment: { ...sampleAssessment, suggestedLeadStatus: "in_contact" }, currentLeadStatus: "negotiation", config });
        expect(result.action).toBe("SUGGEST");
      });

      it("only suggests when the IA gives no written reason", () => {
        const result = evaluateAssessmentPolicy({ assessment: { ...sampleAssessment, suggestedLeadStatus: "negotiation", statusReason: null }, currentLeadStatus: "quote_sent", config });
        expect(result.action).toBe("SUGGEST");
      });
    });

    describe("automatic 'lost' (decided 25/09)", () => {
      const gaveUp: ConversationAssessment = {
        ...sampleAssessment,
        suggestedLeadStatus: "lost",
        statusConfidence: 0.95,
        statusReason: "A cliente informou que já fechou o plano com outra corretora.",
        lossReasonCode: "ja_contratou",
        evidence: ["Obrigada, mas já fechei com outra corretora"],
      };

      it("closes as lost when the customer said so, with code, reason and a customer message", () => {
        const result = evaluateAssessmentPolicy({ assessment: gaveUp, currentLeadStatus: "in_contact", customerMessageCount: 2, config });
        expect(result.action).toBe("AUTO_TRANSITION");
        expect(result.targetStatus).toBe("lost");
      });

      it("only suggests when the transcript has no customer message (silence or missing side)", () => {
        const result = evaluateAssessmentPolicy({ assessment: gaveUp, currentLeadStatus: "in_contact", customerMessageCount: 0, config });
        expect(result.action).toBe("SUGGEST");
        expect(result.reason).toContain("mensagem do cliente");
      });

      it("only suggests without a loss code or a written reason", () => {
        expect(evaluateAssessmentPolicy({ assessment: { ...gaveUp, lossReasonCode: null }, currentLeadStatus: "in_contact", customerMessageCount: 2, config }).action).toBe("SUGGEST");
        expect(evaluateAssessmentPolicy({ assessment: { ...gaveUp, statusReason: "  " }, currentLeadStatus: "in_contact", customerMessageCount: 2, config }).action).toBe("SUGGEST");
      });

      it("only suggests below the automation confidence", () => {
        expect(evaluateAssessmentPolicy({ assessment: { ...gaveUp, statusConfidence: 0.8 }, currentLeadStatus: "in_contact", customerMessageCount: 2, config }).action).toBe("SUGGEST");
      });
    });
  });

  describe("isUsableAssessment", () => {
    it("rejects the degenerate output seen on Neusa Galvao (summary NEUTRAL, next action NONE)", () => {
      expect(isUsableAssessment({ ...sampleAssessment, summary: "NEUTRAL", nextBestAction: "NONE" })).toBe(false);
    });

    it("accepts a written diagnosis", () => {
      expect(isUsableAssessment(sampleAssessment)).toBe(true);
    });
  });
});
