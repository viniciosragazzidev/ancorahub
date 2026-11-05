/**
 * Regra de chat parado (05/11, pedido do Vinicios): lead em cotação, negociação ou fechamento cujo cliente parou
 * de responder sai da lista ativa para "Aguardando retorno"; se continuar sem resposta, vai para Perdido
 * ("sem contato"). Volta sozinho para a etapa anterior quando o cliente responde. Regras puras, sem I/O.
 * Plano: docs/implementations/active/2026-11-05-etapas-e-funil.md
 */

export const STALE_WATCH_STATUSES = ["quote_sent", "negotiation", "documentation_pending", "under_analysis"] as const;

export const STALE_RULE = {
  /** Dias úteis sem mensagem do cliente para ir de uma etapa ativa para "Aguardando retorno". */
  toAwaitingBusinessDays: 5,
  /** Dias úteis em "Aguardando retorno" sem resposta para ir para Perdido. */
  toLostBusinessDays: 10,
  /** Aviso ao corretor quando faltam estes dias úteis para Perdido. */
  warnBeforeBusinessDays: 2,
  /** Se uma pessoa mexeu na etapa há menos destes dias corridos, a regra não mexe. */
  humanGraceDays: 3,
  /** "Manter na etapa" segura o lead por estes dias corridos. */
  holdDays: 7,
} as const;

const TIME_ZONE = "America/Sao_Paulo";
const dayKey = (date: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(date);

/** Dias úteis (segunda a sexta, horário de São Paulo) depois de `from` até `to`, sem contar o dia de `from`. */
export function businessDaysBetween(from: Date, to: Date): number {
  const start = dayKey(from);
  const end = dayKey(to);
  if (end <= start) return 0;
  let count = 0;
  const cursor = new Date(`${start}T12:00:00Z`);
  for (;;) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const key = cursor.toISOString().slice(0, 10);
    if (key > end) break;
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }
  return count;
}

export type StaleStageInput = {
  status: string;
  /** Última mensagem do cliente (qualquer canal); null se ele nunca escreveu. */
  lastCustomerMessageAt: Date | null;
  stageEnteredAt: Date;
  /** Última mudança de etapa feita por uma pessoa (corretor, gestor, diretor). */
  lastHumanStageChangeAt: Date | null;
  holdUntil: Date | null;
  /** A IA marcou o lead como venda em potencial: nunca vai para Perdido sozinho. */
  potentialSale: boolean;
  now: Date;
};

export type StaleStageDecision =
  | { action: "none" }
  | { action: "restore" }
  | { action: "to_awaiting"; silentBusinessDays: number }
  | { action: "warn_lost"; businessDaysLeft: number }
  | { action: "to_lost"; awaitingBusinessDays: number }
  | { action: "potential_sale_hold"; awaitingBusinessDays: number };

export function decideStaleStage(input: StaleStageInput): StaleStageDecision {
  // O cliente respondeu depois de ir para "Aguardando retorno": volta (rede de segurança do retorno imediato).
  if (input.status === "awaiting_reply" && input.lastCustomerMessageAt && input.lastCustomerMessageAt > input.stageEnteredAt) {
    return { action: "restore" };
  }
  if (input.holdUntil && input.holdUntil > input.now) return { action: "none" };
  if (input.lastHumanStageChangeAt
    && input.now.getTime() - input.lastHumanStageChangeAt.getTime() < STALE_RULE.humanGraceDays * 24 * 60 * 60 * 1000) {
    return { action: "none" };
  }

  if ((STALE_WATCH_STATUSES as readonly string[]).includes(input.status)) {
    const silenceStart = input.lastCustomerMessageAt ?? input.stageEnteredAt;
    const silent = businessDaysBetween(silenceStart, input.now);
    return silent >= STALE_RULE.toAwaitingBusinessDays ? { action: "to_awaiting", silentBusinessDays: silent } : { action: "none" };
  }

  if (input.status === "awaiting_reply") {
    const waiting = businessDaysBetween(input.stageEnteredAt, input.now);
    if (waiting >= STALE_RULE.toLostBusinessDays) {
      return input.potentialSale ? { action: "potential_sale_hold", awaitingBusinessDays: waiting } : { action: "to_lost", awaitingBusinessDays: waiting };
    }
    const left = STALE_RULE.toLostBusinessDays - waiting;
    if (!input.potentialSale && left <= STALE_RULE.warnBeforeBusinessDays) return { action: "warn_lost", businessDaysLeft: left };
  }
  return { action: "none" };
}

/** Modo da regra por empresa: simulação primeiro (só lista o que faria), depois ligada. */
export type StaleStageMode = "simulate" | "on" | "off";

export function parseStaleStageMode(value: string | null | undefined): StaleStageMode {
  return value === "on" || value === "off" ? value : "simulate";
}

export function staleStageModeKey(tenantId: string) {
  return `stale_stage_rule_${tenantId}`;
}

export function staleStageSimulationKey(tenantId: string) {
  return `stale_stage_simulation_${tenantId}`;
}
