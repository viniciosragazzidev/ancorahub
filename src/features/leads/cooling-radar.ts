/**
 * Radar "Esfriando" de /leads (25/11/2026, trazido do Radar do DeskComm): quanto tempo o lead aberto está parado e
 * em que nível ele está. Regras puras, sem I/O; a consulta fica em `cooling-radar-query.ts`.
 *
 * - Parado há: desde a última atividade (última mensagem ou 1º contato, ou a entrada na etapa, o que for mais recente).
 * - Em risco: parado de 1 a 3 dias. Crítico: 3 dias ou mais.
 * - Em voo: tem tarefa aberta com prazo no futuro. Continua na lista, rebaixado, com "Retorno em Xd".
 * - Em dia: menos de 1 dia parado; não entra na visão.
 */

/** Etapas abertas que o radar acompanha. Novo é "Sem atribuição"; Em análise espera a operadora. */
export const COOLING_WATCH_STATUSES = [
  "distributed",
  "in_contact",
  "contacted",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "awaiting_reply",
] as const;

export const COOLING_RULE = {
  /** A partir daqui o lead está "Em risco". */
  atRiskAfterDays: 1,
  /** A partir daqui o lead está "Crítico". */
  criticalAfterDays: 3,
} as const;

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type CoolingLevel = "critical" | "at_risk" | "in_flight" | "ok";

export const COOLING_LEVEL_LABELS: Record<CoolingLevel, string> = {
  critical: "Crítico",
  at_risk: "Em risco",
  in_flight: "Em voo",
  ok: "Em dia",
};

type DateLike = Date | string | null | undefined;

function toMs(value: DateLike): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export type CoolingInput = {
  status: string;
  /** Última mensagem (qualquer direção) ou 1º contato. */
  lastContactAt?: DateLike;
  stageEnteredAt?: DateLike;
  assignedAt?: DateLike;
  createdAt?: DateLike;
  /** Prazo da próxima tarefa aberta (a mais próxima no futuro). */
  nextOpenTaskDueAt?: DateLike;
};

export type CoolingInfo = {
  level: CoolingLevel;
  /** Tempo parado, em ms. */
  idleMs: number;
  /** Dias até o retorno marcado (só em voo), no mínimo 1. */
  returnInDays: number | null;
};

export function isCoolingWatched(status: string) {
  return (COOLING_WATCH_STATUSES as readonly string[]).includes(status);
}

/** Momento da última atividade: o mais recente entre contato, entrada na etapa e atribuição (ou a criação). */
export function lastActivityMs(input: CoolingInput): number | null {
  const candidates = [input.lastContactAt, input.stageEnteredAt, input.assignedAt].map(toMs).filter((ms): ms is number => ms !== null);
  if (candidates.length) return Math.max(...candidates);
  return toMs(input.createdAt);
}

/** Nível do lead no radar; null quando a etapa não é acompanhada ou não há data para medir. */
export function classifyCooling(input: CoolingInput, now: Date = new Date()): CoolingInfo | null {
  if (!isCoolingWatched(input.status)) return null;
  const anchor = lastActivityMs(input);
  if (anchor === null) return null;
  const nowMs = now.getTime();
  const idleMs = Math.max(0, nowMs - anchor);
  if (idleMs < COOLING_RULE.atRiskAfterDays * DAY) return { level: "ok", idleMs, returnInDays: null };
  const due = toMs(input.nextOpenTaskDueAt);
  if (due !== null && due > nowMs) {
    return { level: "in_flight", idleMs, returnInDays: Math.max(1, Math.ceil((due - nowMs) / DAY)) };
  }
  return { level: idleMs >= COOLING_RULE.criticalAfterDays * DAY ? "critical" : "at_risk", idleMs, returnInDays: null };
}

const LEVEL_RANK: Record<CoolingLevel, number> = { critical: 0, at_risk: 0, in_flight: 1, ok: 2 };

/** Do mais esquecido para o menos; "Em voo" depois dos que não têm retorno marcado. Fora do radar sai da lista. */
export function sortCoolingRows<T>(rows: readonly T[], infoOf: (row: T) => CoolingInfo | null): Array<{ row: T; info: CoolingInfo }> {
  return rows
    .map((row) => ({ row, info: infoOf(row) }))
    .filter((item): item is { row: T; info: CoolingInfo } => item.info !== null && item.info.level !== "ok")
    .sort((a, b) => LEVEL_RANK[a.info.level] - LEVEL_RANK[b.info.level] || b.info.idleMs - a.info.idleMs);
}

/** "20 min", "5 h", "1 dia", "4 dias". */
export function formatIdle(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.floor(ms / 60_000))} min`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h`;
  const days = Math.floor(ms / DAY);
  return days === 1 ? "1 dia" : `${days} dias`;
}

export function returnInLabel(days: number) {
  return `Retorno em ${days}d`;
}

/**
 * Faixa do cartão do kanban: "Sem resposta há X" quando o lead numa etapa acompanhada passou do SLA de parado
 * (dias da empresa, `slaStagnantDays`). Sem retorno marcado no futuro, como no radar.
 */
export function noReplyStripe(input: CoolingInput, slaStagnantDays: number, now: Date = new Date()): string | null {
  const info = classifyCooling(input, now);
  if (!info || info.level === "ok" || info.level === "in_flight") return null;
  if (info.idleMs < Math.max(1, slaStagnantDays) * DAY) return null;
  return `Sem resposta há ${formatIdle(info.idleMs)}`;
}

/** Tempo desde o último contato, para o cartão: "há 2 dias" ou "Sem contato ainda". */
export function lastContactLabel(lastContactAt: DateLike, now: Date = new Date()): string {
  const ms = toMs(lastContactAt);
  if (ms === null) return "Sem contato ainda";
  return `há ${formatIdle(Math.max(0, now.getTime() - ms))}`;
}
