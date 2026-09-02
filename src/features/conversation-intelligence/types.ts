import { z } from "zod";

export const ConversationStageEnum = z.enum([
  "INITIAL_CONTACT",
  "DISCOVERY",
  "QUALIFICATION",
  "QUOTE_PREPARATION",
  "QUOTE_PRESENTED",
  "NEGOTIATION",
  "DOCUMENT_COLLECTION",
  "ANALYSIS",
  "CLOSING",
  "POST_SALE",
  "UNKNOWN",
]);
export type ConversationStage = z.infer<typeof ConversationStageEnum>;

export const CustomerIntentEnum = z.enum([
  "VERY_HIGH",
  "HIGH",
  "MEDIUM",
  "LOW",
  "NONE",
  "UNKNOWN",
]);
export type CustomerIntent = z.infer<typeof CustomerIntentEnum>;

export const EngagementLevelEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type EngagementLevel = z.infer<typeof EngagementLevelEnum>;

export const SentimentEnum = z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE"]);
export type Sentiment = z.infer<typeof SentimentEnum>;

export const PendingFromEnum = z.enum([
  "BROKER",
  "CUSTOMER",
  "INTERNAL",
  "NONE",
  "UNKNOWN",
]);
export type PendingFrom = z.infer<typeof PendingFromEnum>;

/**
 * Saída estruturada produzida pelo modelo de IA ao analisar uma conversa.
 */
export const ConversationAssessmentSchema = z.object({
  conversationStage: ConversationStageEnum,
  customerIntent: CustomerIntentEnum,
  engagement: EngagementLevelEnum,
  sentiment: SentimentEnum,
  objections: z.array(z.string()).default([]),
  buyingSignals: z.array(z.string()).default([]),
  pendingFrom: PendingFromEnum,
  nextBestAction: z.string().trim().min(1),
  suggestedLeadStatus: z.string().nullable().optional(),
  statusConfidence: z.number().min(0).max(1),
  summary: z.string().trim().min(1),
  risk: z.string().nullable().optional(),
  opportunity: z.string().nullable().optional(),
  facts: z.array(z.string()).default([]),
  inferences: z.array(z.string()).default([]),
});
export type ConversationAssessment = z.infer<typeof ConversationAssessmentSchema>;

/**
 * Estado consolidado da inteligência do lead para renderização em dashboards e fichas de atendimento.
 */
export interface LeadIntelligenceState {
  leadId: string;
  tenantId: string;
  assessment: ConversationAssessment;
  lastAnalyzedAt: Date;
  lastAnalyzedMessageId?: string | null;
  conversationRevision: number;
  aiModel: string;
}

/**
 * Resultado da avaliação de políticas para saber se a sugestão da IA provoca transição no CRM.
 */
export type PolicyExecutionResult = {
  action: "AUTO_TRANSITION" | "SUGGEST" | "INSIGHT_ONLY";
  transitionAllowed: boolean;
  fromStatus: string;
  targetStatus: string | null;
  confidence: number;
  reason: string;
  aiFeedbackPayload?: {
    type: string;
    summary: string;
    objections: string[];
    pendingFrom: string;
    nextBestAction: string;
    source: "AI";
    confidence: number;
  };
};
