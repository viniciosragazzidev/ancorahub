import type { ConversationAssessment, PolicyExecutionResult } from "./types";
import type { ConversationIntelligenceConfig } from "@/shared/domain-root/conversation-intelligence-root";

export interface PolicyEvaluationInput {
  assessment: ConversationAssessment;
  currentLeadStatus: string;
  config: Pick<
    ConversationIntelligenceConfig,
    | "confidenceThresholdAuto"
    | "confidenceThresholdSuggest"
    | "autoAllowedTransitions"
    | "suggestOnlyTransitions"
    | "systemOnlyTransitions"
  >;
}

/**
 * Avalia a recomendação estruturada da IA contra as políticas do Pipeline.
 *
 * Princípio Arquitetural:
 * A IA NUNCA atualiza o status diretamente no banco de dados.
 * Ela gera uma hipótese/avaliação estruturada com nível de confiança,
 * e esta função determina o resultado operacional.
 */
export function evaluateAssessmentPolicy(
  input: PolicyEvaluationInput,
): PolicyExecutionResult {
  const { assessment, currentLeadStatus, config } = input;
  const suggestedStatus = assessment.suggestedLeadStatus?.trim() || null;
  const confidence = assessment.statusConfidence;

  // 1. Se não houver sugestão ou se a sugestão for idêntica ao status atual -> Apenas Insights
  if (!suggestedStatus || suggestedStatus === currentLeadStatus) {
    return {
      action: "INSIGHT_ONLY",
      transitionAllowed: false,
      fromStatus: currentLeadStatus,
      targetStatus: null,
      confidence,
      reason: "Status sugerido idêntico ao status atual ou não informado.",
    };
  }

  const transitionPair = `${currentLeadStatus}->${suggestedStatus}`;
  const genericWildcardPair = `any->${suggestedStatus}`;

  // 2. Transições exclusivas do sistema (ex: converted) NUNCA são executadas automaticamente
  const isSystemOnly =
    config.systemOnlyTransitions.includes(transitionPair) ||
    config.systemOnlyTransitions.includes(genericWildcardPair);

  if (isSystemOnly) {
    return {
      action: "INSIGHT_ONLY",
      transitionAllowed: false,
      fromStatus: currentLeadStatus,
      targetStatus: suggestedStatus,
      confidence,
      reason: `A transição para '${suggestedStatus}' é restrita a eventos de sistema (SYSTEM_ONLY).`,
    };
  }

  // 3. Faixa 1: Confiança < Limiar de Sugestão (ex: < 0.70) -> Apenas Insights
  if (confidence < config.confidenceThresholdSuggest) {
    return {
      action: "INSIGHT_ONLY",
      transitionAllowed: false,
      fromStatus: currentLeadStatus,
      targetStatus: suggestedStatus,
      confidence,
      reason: `Confiança (${(confidence * 100).toFixed(0)}%) abaixo do limiar de sugestão (${(config.confidenceThresholdSuggest * 100).toFixed(0)}%).`,
    };
  }

  // 4. Faixa 2: Confiança entre Sugestão e Automação (ex: 0.70 a 0.89) OU regra declarada como SUGGEST_ONLY
  const isExplicitSuggestOnly =
    config.suggestOnlyTransitions.includes(transitionPair) ||
    config.suggestOnlyTransitions.includes(genericWildcardPair);

  const isAutoEligible =
    confidence >= config.confidenceThresholdAuto &&
    (config.autoAllowedTransitions.includes(transitionPair) ||
      config.autoAllowedTransitions.includes(genericWildcardPair)) &&
    !isExplicitSuggestOnly;

  if (isAutoEligible) {
    return {
      action: "AUTO_TRANSITION",
      transitionAllowed: true,
      fromStatus: currentLeadStatus,
      targetStatus: suggestedStatus,
      confidence,
      reason: `Confiança alta (${(confidence * 100).toFixed(0)}%) e regra de transição '${transitionPair}' autorizada para automação segura.`,
      aiFeedbackPayload: buildAIFeedbackPayload(assessment),
    };
  }

  // 5. Caso contrário -> SUGGEST
  return {
    action: "SUGGEST",
    transitionAllowed: false,
    fromStatus: currentLeadStatus,
    targetStatus: suggestedStatus,
    confidence,
    reason: isExplicitSuggestOnly
      ? `A transição '${transitionPair}' requer confirmação humana (SUGGEST_ONLY).`
      : `Confiança de ${(confidence * 100).toFixed(0)}% elegível apenas para sugestão.`,
    aiFeedbackPayload: buildAIFeedbackPayload(assessment),
  };
}

/**
 * Monta o payload padronizado de feedback automático para a timeline e auditoria.
 */
export function buildAIFeedbackPayload(assessment: ConversationAssessment) {
  return {
    type: `AI_${assessment.conversationStage}`,
    summary: assessment.summary,
    objections: assessment.objections,
    pendingFrom: assessment.pendingFrom,
    nextBestAction: assessment.nextBestAction,
    source: "AI" as const,
    confidence: assessment.statusConfidence,
  };
}
