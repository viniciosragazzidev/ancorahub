export type AiPotentialSaleCheck = {
  isPotentialSale: boolean;
  reason?: string;
};

/**
 * Avalia dados já disponíveis no cliente ou no servidor, sem acessar sessão ou banco.
 */
export function isAiPotentialSale(qualificationDetails: unknown): AiPotentialSaleCheck {
  if (!qualificationDetails || typeof qualificationDetails !== "object") {
    return { isPotentialSale: false };
  }

  const aiIntelligence = (qualificationDetails as Record<string, unknown>).aiIntelligence;
  if (!aiIntelligence || typeof aiIntelligence !== "object") {
    return { isPotentialSale: false };
  }

  const ai = aiIntelligence as Record<string, unknown>;
  const customerIntent = ai.customerIntent;
  if (customerIntent === "VERY_HIGH" || customerIntent === "HIGH") {
    return {
      isPotentialSale: true,
      reason: `Intenção de compra avaliada pela IA como '${customerIntent}'`,
    };
  }

  const buyingSignals = ai.buyingSignals;
  if (Array.isArray(buyingSignals) && buyingSignals.length > 0) {
    const signalSummary = buyingSignals
      .slice(0, 2)
      .filter((signal): signal is string => typeof signal === "string")
      .join(", ");
    if (signalSummary) {
      return {
        isPotentialSale: true,
        reason: `Sinais de compra detectados pela IA: "${signalSummary}"`,
      };
    }
  }

  const conversationStage = ai.conversationStage;
  if (
    conversationStage === "NEGOTIATION" ||
    conversationStage === "DOCUMENT_COLLECTION" ||
    conversationStage === "CLOSING"
  ) {
    return {
      isPotentialSale: true,
      reason: `Estágio da conversa diagnosticado pela IA como '${conversationStage}'`,
    };
  }

  return { isPotentialSale: false };
}
