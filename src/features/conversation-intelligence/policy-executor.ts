import type { ConversationAssessment, PolicyExecutionResult } from "./types";
import { LEAD_STATUS_ORDER } from "@/features/leads/lead-status-constants";

/** Funnel stages the IA may advance through by itself ("forward" rule). Never from or to converted/lost. */
const FORWARD_STAGES = new Set(["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]);
/** Stages before the attendance started: leaving them needs a real exchange between broker and customer. */
const PRE_CONTACT_STAGES = new Set(["new", "distributed"]);

function isForwardMove(from: string, to: string) {
  return FORWARD_STAGES.has(from) && FORWARD_STAGES.has(to)
    && (LEAD_STATUS_ORDER[to] ?? -1) > (LEAD_STATUS_ORDER[from] ?? Number.POSITIVE_INFINITY);
}

function forwardSteps(from: string, to: string) {
  return (LEAD_STATUS_ORDER[to] ?? 0) - (LEAD_STATUS_ORDER[from] ?? 0);
}

/** The funnel stage right after `from` (Novo → Distribuído → Em contato → Cotação enviada → …). */
function nextForwardStage(from: string) {
  const order = (LEAD_STATUS_ORDER[from] ?? -1) + 1;
  return [...FORWARD_STAGES].find((stage) => LEAD_STATUS_ORDER[stage] === order) ?? null;
}
import type { ConversationIntelligenceConfig } from "@/shared/domain-root/conversation-intelligence-root";

export interface PolicyEvaluationInput {
  assessment: ConversationAssessment;
  currentLeadStatus: string;
  /**
   * Customer messages in the analyzed window. An automatic "lost" must rest
   * on what the customer said: silence alone (or a transcript missing the
   * customer's side) only ever produces a suggestion.
   */
  customerMessageCount?: number;
  /** Messages the broker wrote (bot messages do not count). */
  brokerMessageCount?: number;
  /** Tenant choice: "suggest" turns every automatic move into a suggestion. */
  mode?: "auto" | "suggest";
  config: Pick<
    ConversationIntelligenceConfig,
    | "confidenceThresholdAuto"
    | "confidenceThresholdAutoOneStep"
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

  // 28/10: one stage forward needs the one-step threshold (75%); skipping stages keeps 90%.
  // Seen several stages ahead at 75%+, the lead advances one stage: each later stage
  // implies the next one happened (e.g. negotiating implies the quote was sent).
  const forward = config.autoAllowedTransitions.includes("forward") && isForwardMove(currentLeadStatus, suggestedStatus);
  const steps = forward ? forwardSteps(currentLeadStatus, suggestedStatus) : 0;
  const partial = forward && steps >= 2 && confidence < config.confidenceThresholdAuto && confidence >= config.confidenceThresholdAutoOneStep;
  const target = partial ? nextForwardStage(currentLeadStatus) ?? suggestedStatus : suggestedStatus;
  const threshold = forward && (steps === 1 || partial) ? config.confidenceThresholdAutoOneStep : config.confidenceThresholdAuto;
  const isAutoEligible =
    confidence >= threshold &&
    (config.autoAllowedTransitions.includes(transitionPair) ||
      config.autoAllowedTransitions.includes(genericWildcardPair) ||
      forward) &&
    !isExplicitSuggestOnly;

  // An automatic move rests on what the customer said; leaving Novo/Distribuído
  // also needs the broker to have answered (a bot exchange alone is not contact).
  const customerSpoke = (input.customerMessageCount ?? 0) > 0;
  const realExchange = customerSpoke && (input.brokerMessageCount ?? 0) > 0;
  if (isAutoEligible && (!customerSpoke || (PRE_CONTACT_STAGES.has(currentLeadStatus) && !realExchange))) {
    return {
      action: "SUGGEST",
      transitionAllowed: false,
      fromStatus: currentLeadStatus,
      targetStatus: suggestedStatus,
      confidence,
      reason: customerSpoke
        ? "O corretor ainda não conversou com o cliente; requer confirmação do corretor."
        : "Sem mensagem do cliente que comprove o avanço; requer confirmação do corretor.",
      aiFeedbackPayload: buildAIFeedbackPayload(assessment),
    };
  }

  if (isAutoEligible && input.mode === "suggest") {
    return {
      action: "SUGGEST",
      transitionAllowed: false,
      fromStatus: currentLeadStatus,
      targetStatus: suggestedStatus,
      confidence,
      reason: "A empresa escolheu receber só sugestões da IA.",
      aiFeedbackPayload: buildAIFeedbackPayload(assessment),
    };
  }

  // Every automatic change is recorded with its reason: without one written
  // by the IA, it is only a suggestion.
  if (isAutoEligible && !assessment.statusReason?.trim()) {
    return {
      action: "SUGGEST",
      transitionAllowed: false,
      fromStatus: currentLeadStatus,
      targetStatus: suggestedStatus,
      confidence,
      reason: "Mudança sugerida sem motivo por escrito; requer confirmação do corretor.",
      aiFeedbackPayload: buildAIFeedbackPayload(assessment),
    };
  }

  // "lost" closes the attendance: auto only with a catalog loss code, a
  // written reason and at least one customer message backing it.
  if (isAutoEligible && suggestedStatus === "lost") {
    const missing = !assessment.lossReasonCode
      ? "código do motivo de perda"
      : !assessment.statusReason?.trim()
        ? "motivo por escrito"
        : !(input.customerMessageCount && input.customerMessageCount > 0)
          ? "mensagem do cliente que comprove a desistência"
          : null;
    if (missing) {
      return {
        action: "SUGGEST",
        transitionAllowed: false,
        fromStatus: currentLeadStatus,
        targetStatus: suggestedStatus,
        confidence,
        reason: `Perda sugerida sem ${missing}; requer confirmação do corretor.`,
        aiFeedbackPayload: buildAIFeedbackPayload(assessment),
      };
    }
  }

  if (isAutoEligible) {
    return {
      action: "AUTO_TRANSITION",
      transitionAllowed: true,
      fromStatus: currentLeadStatus,
      targetStatus: target,
      confidence,
      reason: partial
        ? `A IA vê o lead em '${suggestedStatus}' (${(confidence * 100).toFixed(0)}%): avança uma etapa, até '${target}'; as próximas seguem nas próximas análises.`
        : `Confiança alta (${(confidence * 100).toFixed(0)}%) e regra de transição '${transitionPair}' autorizada para automação segura.`,
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

const PLACEHOLDER_VALUES = new Set(["NONE", "UNKNOWN", "NEUTRAL", "POSITIVE", "NEGATIVE", "N/A", "NULL"]);

/**
 * Rejects degenerate model output — on 25/09 a fallback model answered
 * summary "NEUTRAL" / nextBestAction "NONE" / confidence 0 and overwrote a
 * good analysis. A real diagnosis has a written summary and next action.
 */
export function isUsableAssessment(assessment: ConversationAssessment): boolean {
  const summary = assessment.summary.trim();
  const nextAction = assessment.nextBestAction.trim();
  return summary.length >= 20
    && !PLACEHOLDER_VALUES.has(summary.toUpperCase())
    && nextAction.length >= 4
    && !PLACEHOLDER_VALUES.has(nextAction.toUpperCase());
}

/** A note of the analysis on the lead's timeline at least this often, even with nothing new. */
const FEEDBACK_NOTE_EVERY_MS = 6 * 60 * 60_000;

/**
 * What is new in an analysis. It runs 1 minute after every message (28/10): the broker is
 * notified and the timeline gets a note only on a move, a suggestion different from the last
 * one, or the first diagnosis; the note also repeats every 6 hours to keep the summary current.
 */
export function analysisNews(input: {
  autoMoved: boolean;
  action: PolicyExecutionResult["action"];
  targetStatus: string | null;
  previous: { action?: string | null; targetStatus?: string | null } | null;
  lastNoteAt: string | null;
  now: Date;
}) {
  const firstDiagnosis = !input.previous;
  const newSuggestion = input.action === "SUGGEST"
    && (input.previous?.action !== "SUGGEST" || (input.previous?.targetStatus ?? null) !== input.targetStatus);
  const news = input.autoMoved || newSuggestion || firstDiagnosis;
  const lastNote = input.lastNoteAt ? Date.parse(input.lastNoteAt) : Number.NaN;
  const noteDue = Number.isNaN(lastNote) || input.now.getTime() - lastNote >= FEEDBACK_NOTE_EVERY_MS;
  return { notify: news, writeNote: news || noteDue };
}
