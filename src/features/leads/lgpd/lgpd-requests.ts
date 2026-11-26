/**
 * Pedidos do titular com prazo (LGPD, 26/11/2026). Regras puras: prazo de 15 dias corridos, texto do prazo e da
 * situação, validação de "Registrar pedido". A tabela é `lgpd_requests` (migration 0240).
 *
 * Os dias contam no calendário de Brasília: um pedido feito às 23h de 10/11 vence em 25/11, e "vence em 1 dia"
 * quer dizer amanhã, não daqui a 24 horas.
 */

export const LGPD_REQUEST_DEADLINE_DAYS = 15;
/** A partir de quantos dias restantes o prazo passa a pedir atenção. */
export const LGPD_REQUEST_WARNING_DAYS = 3;
export const LGPD_REQUEST_MAX_BACKDATE_DAYS = 365;
export const MIN_LGPD_REQUEST_REASON_LENGTH = 5;
export const MAX_LGPD_REQUEST_REASON_LENGTH = 500;

export const LGPD_REQUEST_KINDS = ["export", "anonymize"] as const;
export type LgpdRequestKind = (typeof LGPD_REQUEST_KINDS)[number];

export const LGPD_REQUEST_KIND_LABEL: Record<LgpdRequestKind, string> = {
  export: "Exportar dados",
  anonymize: "Anonimizar",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const TIME_ZONE = "America/Sao_Paulo";

/** Dia (AAAA-MM-DD) de uma data no fuso de Brasília. */
export function brasiliaDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dayNumber(day: string) {
  const [year, month, date] = day.split("-").map(Number);
  return Math.round(Date.UTC(year, month - 1, date) / DAY_MS);
}

/** Prazo: 15 dias corridos depois do pedido, no mesmo horário. */
export function lgpdRequestDueAt(requestedAt: Date) {
  return new Date(requestedAt.getTime() + LGPD_REQUEST_DEADLINE_DAYS * DAY_MS);
}

/** Dias de calendário (Brasília) entre hoje e o prazo. Negativo: já passou. */
export function lgpdDaysUntilDue(dueAt: Date, now = new Date()) {
  return dayNumber(brasiliaDay(dueAt)) - dayNumber(brasiliaDay(now));
}

export type LgpdTone = "success" | "warning" | "danger" | "info";
export type LgpdDeadline = { label: string; tone: LgpdTone | null };

const days = (count: number) => `${count} ${count === 1 ? "dia" : "dias"}`;

/** Texto da coluna Prazo. Aberto: quanto falta ou há quanto venceu. Atendido: se foi no prazo. */
export function describeLgpdDeadline(input: { dueAt: Date; completedAt: Date | null }, now = new Date()): LgpdDeadline {
  if (input.completedAt) {
    // Atendido até o fim do dia do prazo (Brasília) conta como no prazo.
    return lgpdDaysUntilDue(input.dueAt, input.completedAt) >= 0
      ? { label: "Atendido no prazo", tone: "success" }
      : { label: "Atendido fora do prazo", tone: "warning" };
  }
  const left = lgpdDaysUntilDue(input.dueAt, now);
  if (left < 0) return { label: `Vencido há ${days(-left)}`, tone: "danger" };
  if (left === 0) return { label: "Vence hoje", tone: "danger" };
  if (left <= LGPD_REQUEST_WARNING_DAYS) return { label: `Vence em ${days(left)}`, tone: "warning" };
  return { label: `Vence em ${days(left)}`, tone: null };
}

export type LgpdSituation = { label: string; tone: LgpdTone | null };

/** Coluna Situação. */
export function describeLgpdSituation(input: { dueAt: Date; completedAt: Date | null }, now = new Date()): LgpdSituation {
  if (input.completedAt) return { label: "Atendido", tone: "success" };
  return lgpdDaysUntilDue(input.dueAt, now) < 0 ? { label: "Em aberto, vencido", tone: "danger" } : { label: "Em aberto", tone: null };
}

/** Ordem da tabela: abertos primeiro (o que vence antes no topo), depois os atendidos mais recentes. */
export function sortLgpdRequests<T extends { dueAt: Date; completedAt: Date | null }>(rows: T[]) {
  return [...rows].sort((a, b) => {
    if (!a.completedAt && b.completedAt) return -1;
    if (a.completedAt && !b.completedAt) return 1;
    if (!a.completedAt && !b.completedAt) return a.dueAt.getTime() - b.dueAt.getTime();
    return (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0);
  });
}

/** Quantos pedidos abertos já venceram ou vencem em até 3 dias (resumo da seção). */
export function countLgpdAttention(rows: Array<{ dueAt: Date; completedAt: Date | null }>, now = new Date()) {
  let overdue = 0;
  let soon = 0;
  for (const row of rows) {
    if (row.completedAt) continue;
    const left = lgpdDaysUntilDue(row.dueAt, now);
    if (left < 0) overdue += 1;
    else if (left <= LGPD_REQUEST_WARNING_DAYS) soon += 1;
  }
  return { overdue, soon };
}

/** Dentre os pedidos do lead, o aberto mais antigo do tipo: é ele que o atendimento na ficha conclui. */
export function pickOpenLgpdRequest<T extends { kind: string; requestedAt: Date; completedAt: Date | null }>(rows: T[], kind: LgpdRequestKind) {
  return rows
    .filter((row) => row.kind === kind && !row.completedAt)
    .sort((a, b) => a.requestedAt.getTime() - b.requestedAt.getTime())[0] ?? null;
}

export type RegisterLgpdRequestInput = { leadId: unknown; kind: unknown; reason: unknown; requestedOn: unknown };
export type RegisterLgpdRequestCheck =
  | { ok: true; leadId: string; kind: LgpdRequestKind; reason: string; requestedAt: Date; dueAt: Date }
  | { ok: false; error: string };

/**
 * "Registrar pedido": pedido que chegou por fora (e-mail, telefone). O dia do pedido pode ser no passado (o prazo
 * conta de quando o titular pediu, não de quando foi registrado), nunca no futuro nem há mais de um ano.
 * Pedido de hoje grava a hora atual; de outro dia, meio-dia de Brasília.
 */
export function validateRegisterLgpdRequest(input: RegisterLgpdRequestInput, now = new Date()): RegisterLgpdRequestCheck {
  const leadId = typeof input.leadId === "string" ? input.leadId.trim() : "";
  if (!leadId) return { ok: false, error: "Escolha o lead do titular." };
  if (typeof input.kind !== "string" || !(LGPD_REQUEST_KINDS as readonly string[]).includes(input.kind)) return { ok: false, error: "Escolha o tipo do pedido." };
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < MIN_LGPD_REQUEST_REASON_LENGTH) return { ok: false, error: "Escreva como o pedido chegou." };
  if (reason.length > MAX_LGPD_REQUEST_REASON_LENGTH) return { ok: false, error: `O motivo pode ter até ${MAX_LGPD_REQUEST_REASON_LENGTH} caracteres.` };
  const requestedOn = typeof input.requestedOn === "string" ? input.requestedOn.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedOn) || Number.isNaN(Date.parse(`${requestedOn}T12:00:00-03:00`))) return { ok: false, error: "Informe o dia do pedido." };
  const today = brasiliaDay(now);
  const back = dayNumber(today) - dayNumber(requestedOn);
  if (back < 0) return { ok: false, error: "O dia do pedido não pode ser no futuro." };
  if (back > LGPD_REQUEST_MAX_BACKDATE_DAYS) return { ok: false, error: "O dia do pedido pode ser de até um ano atrás." };
  const requestedAt = back === 0 ? now : new Date(`${requestedOn}T12:00:00-03:00`);
  return { ok: true, leadId, kind: input.kind as LgpdRequestKind, reason, requestedAt, dueAt: lgpdRequestDueAt(requestedAt) };
}

/** Data curta de Brasília (26/11/2026). */
export function formatLgpdDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
