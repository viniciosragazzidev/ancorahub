import "server-only";

import { analyzeLeadConversation } from "./analyzer";
import { conversationIntelligenceDomainRoot } from "@/shared/domain-root/conversation-intelligence-root";

// Mapa de debouncing em memória por leadId
const pendingTimers = new Map<string, NodeJS.Timeout>();

/**
 * Agenda uma análise com debounce para um lead quando novas mensagens de WhatsApp
 * (recebidas ou enviadas pelo corretor) são registradas.
 */
export function scheduleLeadConversationAnalysis(
  leadId: string,
  tenantId: string,
  customDebounceMs?: number,
): void {
  if (!leadId || !tenantId) return;

  const existingTimer = pendingTimers.get(leadId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const debounceSeconds = conversationIntelligenceDomainRoot.defaults.analysisDebounceSeconds;
  const debounceMs = customDebounceMs ?? debounceSeconds * 1000;

  const timer = setTimeout(async () => {
    pendingTimers.delete(leadId);
    try {
      await analyzeLeadConversation(leadId, tenantId);
    } catch (error) {
      console.error("[conversation-intelligence] Erro no job debounced do lead:", leadId, error);
    }
  }, debounceMs);

  // Impedir que o timer bloqueie o encerramento do processo em ambientes serverless/node
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  pendingTimers.set(leadId, timer);
}

/**
 * Executa a análise imediatamente (cancelando qualquer timer pendente).
 */
export async function forceLeadConversationAnalysis(
  leadId: string,
  tenantId: string,
) {
  const existingTimer = pendingTimers.get(leadId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    pendingTimers.delete(leadId);
  }

  return analyzeLeadConversation(leadId, tenantId);
}
