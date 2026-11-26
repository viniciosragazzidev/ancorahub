/**
 * Último acesso de um membro da equipe (/equipe): texto relativo para a tabela ("há 3 h", "ontem", "há 12 dias",
 * "Nunca entrou") e data com hora para a gaveta. Os dias contam no calendário de São Paulo, igual ao resto do Lite.
 *
 * A fonte é a sessão mais recente do better-auth (created_at/updated_at da tabela session). A sessão só é tocada
 * uma vez por dia (updateAge), então o texto tem precisão de horas só perto do login; para "há quantos dias" basta.
 */
import { liteDateFormatter } from "@/components/lite/format/date";

/** Sem entrar há mais que isso, a linha fica em texto secundário. */
export const LAST_ACCESS_STALE_DAYS = 7;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function toDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(date.getTime()) ? null : date;
}

const dayKey = liteDateFormatter({ year: "numeric", month: "2-digit", day: "2-digit" });

/** Número do dia no calendário de São Paulo (dias desde 1970), para comparar "hoje" e "ontem". */
function calendarDay(date: Date): number {
  const parts = Object.fromEntries(dayKey.formatToParts(date).map((part) => [part.type, part.value]));
  return Math.floor(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) / DAY);
}

/** Texto curto para a coluna "Último acesso". */
export function formatLastAccess(value: Date | string | null | undefined, now: Date = new Date()): string {
  const date = toDate(value);
  if (!date) return "Nunca entrou";
  const elapsed = Math.max(0, now.getTime() - date.getTime());
  const days = calendarDay(now) - calendarDay(date);
  if (days <= 0) {
    if (elapsed < MINUTE) return "agora";
    if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
    return `há ${Math.floor(elapsed / HOUR)} h`;
  }
  if (days === 1) return "ontem";
  if (days < 60) return `há ${days} dias`;
  const months = Math.floor(days / 30);
  if (months < 12) return `há ${months} meses`;
  const years = Math.floor(days / 365);
  return years === 1 ? "há 1 ano" : `há ${years} anos`;
}

/** Nunca entrou ou está há mais de 7 dias sem entrar. */
export function isLastAccessStale(value: Date | string | null | undefined, now: Date = new Date(), days = LAST_ACCESS_STALE_DAYS): boolean {
  const date = toDate(value);
  if (!date) return true;
  return now.getTime() - date.getTime() > days * DAY;
}

const detailFormat = liteDateFormatter({ day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Data e hora para a gaveta: "25/11/2026 às 14:32". */
export function formatLastAccessDetail(value: Date | string | null | undefined): string {
  const date = toDate(value);
  if (!date) return "Nunca entrou";
  const parts = Object.fromEntries(detailFormat.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute}`;
}

/** Texto da linha nas listas do gestor e do supervisor: "Entrou há 3 h", "Entrou ontem" ou "Nunca entrou". */
export function formatLastAccessMeta(value: Date | string | null | undefined, now: Date = new Date()): string {
  const text = formatLastAccess(value, now);
  return toDate(value) ? `Entrou ${text}` : text;
}

/**
 * Último acesso de uma pessoa a partir do mapa da consulta agregada (getLastAccessByUser). undefined quando a consulta
 * falhou (a tela não mostra nada); null quando a pessoa nunca entrou ou ainda não tem usuário.
 */
export function lastAccessOf(map: Map<string, string | null> | null, userId: string | null | undefined): string | null | undefined {
  if (!map) return undefined;
  return userId ? map.get(userId) ?? null : null;
}

/** Ordem por último acesso: mais antigo primeiro, quem nunca entrou no topo. */
export function compareLastAccess(a: string | null | undefined, b: string | null | undefined): number {
  const ta = toDate(a)?.getTime() ?? Number.NEGATIVE_INFINITY;
  const tb = toDate(b)?.getTime() ?? Number.NEGATIVE_INFINITY;
  if (ta === tb) return 0;
  return ta < tb ? -1 : 1;
}
