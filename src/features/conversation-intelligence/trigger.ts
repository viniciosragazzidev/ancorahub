import "server-only";

import { analyzeLeadConversation } from "./analyzer";
import { isAiBudgetExceeded } from "@/features/ai-gateway/anthropic-budget";
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
      // Over the monthly AI budget the 10-minute economy job analyses it instead.
      if (await isAiBudgetExceeded()) return;
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

const recentRequests = new Map<string, number>();
const REQUEST_COOLDOWN_MS = 15 * 60_000;

/**
 * On-demand analysis (Insights opened, a tip about this lead): runs at most once
 * every 15 min per lead in this instance, so opening screens never floods the AI.
 * Returns false when it was skipped.
 */
const perUser = new Map<string, number[]>();
const PER_USER_PER_HOUR = 20;

export async function requestLeadConversationAnalysis(leadId: string, tenantId: string, userId?: string) {
  const now = Date.now();
  const last = recentRequests.get(leadId);
  if (last && now - last < REQUEST_COOLDOWN_MS) return false;
  // At most 20 on-demand analyses per broker per hour (opening screens never runs up the AI bill).
  if (userId) {
    const recent = (perUser.get(userId) ?? []).filter((at) => now - at < 60 * 60_000);
    if (recent.length >= PER_USER_PER_HOUR) return false;
    perUser.set(userId, [...recent, now]);
  }
  recentRequests.set(leadId, now);
  if (recentRequests.size > 2_000) for (const [key, at] of recentRequests) if (now - at > REQUEST_COOLDOWN_MS) recentRequests.delete(key);
  await analyzeLeadConversation(leadId, tenantId).catch((error) => console.error("[conversation-intelligence] on-demand analysis failed", leadId, error));
  return true;
}
