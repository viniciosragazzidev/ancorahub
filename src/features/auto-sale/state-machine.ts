/** Máquina de estados da negociação (§3 do plano). Pura e determinística. */
import type { AutoSaleStage, AutoSaleStatus } from "./contracts";

export const AGENT_ACTIONS = ["ask", "confirm", "quote", "recommend", "cheaper", "handle_objection", "close", "request_documents", "call_manager", "hold", "end"] as const;
export type AgentAction = (typeof AGENT_ACTIONS)[number];

const STAGE_ORDER: Record<AutoSaleStage, number> = {
  chosen: 0, confirming: 1, preferences: 2, quoted: 3, recommending: 4, objections: 4, closing: 5, documents: 6,
  manager_called: 7, handed_off: 8, won: 9, lost: 9,
};

export const TERMINAL_STAGES: readonly AutoSaleStage[] = ["handed_off", "won", "lost"];

/** Etapa da negociação depois de uma ação executada pelo agente. */
export function nextStage(current: AutoSaleStage, action: AgentAction): AutoSaleStage {
  if (TERMINAL_STAGES.includes(current)) return current;
  switch (action) {
    case "confirm": return current === "chosen" ? "confirming" : current;
    case "ask": return STAGE_ORDER[current] < STAGE_ORDER.preferences ? "preferences" : current;
    case "quote":
    case "cheaper": return STAGE_ORDER[current] <= STAGE_ORDER.quoted || current === "objections" || current === "recommending" ? "quoted" : current;
    case "recommend": return STAGE_ORDER[current] <= STAGE_ORDER.recommending ? "recommending" : current;
    case "handle_objection": return STAGE_ORDER[current] >= STAGE_ORDER.quoted && STAGE_ORDER[current] <= STAGE_ORDER.closing ? "objections" : current;
    case "close": return STAGE_ORDER[current] >= STAGE_ORDER.quoted && STAGE_ORDER[current] < STAGE_ORDER.closing ? "closing" : current;
    case "request_documents": return STAGE_ORDER[current] >= STAGE_ORDER.quoted ? "documents" : current;
    case "call_manager": return "manager_called";
    case "end": return "lost";
    case "hold": return current;
  }
}

/** Ações que exigem uma cotação já enviada: sem snapshot, viram "quote" (nunca preço inventado). */
export function requiresOffer(action: AgentAction) {
  return action === "recommend" || action === "close" || action === "request_documents" || action === "cheaper";
}

/** Etapa do lead (funil do CRM) correspondente; null = não mexe. */
export function leadStatusForStage(stage: AutoSaleStage): string | null {
  switch (stage) {
    case "confirming":
    case "preferences": return "in_contact";
    case "quoted": return "quote_sent";
    case "recommending":
    case "objections":
    case "closing": return "negotiation";
    case "documents": return "documentation_pending";
    default: return null;
  }
}

const LEAD_ORDER: Record<string, number> = {
  new: 0, distributed: 1, awaiting_reply: 1, in_contact: 2, quote_sent: 3, negotiation: 4, documentation_pending: 5, under_analysis: 6, converted: 7, lost: 8,
};

/**
 * O agente só move o lead para frente e nunca para Convertido ou Perdido (só uma pessoa marca isso).
 * Sair de "Aguardando retorno" para a etapa da conversa vale (o cliente voltou a responder).
 */
export function shouldMoveLead(current: string, target: string | null): target is string {
  if (!target || target === current) return false;
  if (target === "converted" || target === "lost" || current === "converted" || current === "lost" || current === "under_analysis") return false;
  return (LEAD_ORDER[target] ?? -1) > (LEAD_ORDER[current] ?? 99);
}

/** Tempo máximo de cada etapa sem o cliente responder antes de chamar o gestor (ms). */
export const STAGE_TIMEOUT_MS: Partial<Record<AutoSaleStage, number>> = {
  chosen: 15 * 60_000,
};

export function isOpenStatus(status: AutoSaleStatus) {
  return status === "active" || status === "paused" || status === "waiting_manager";
}

/** O agente pode responder agora? Pausada ou aguardando o gestor, não. */
export function agentMayAct(status: AutoSaleStatus) {
  return status === "active";
}
