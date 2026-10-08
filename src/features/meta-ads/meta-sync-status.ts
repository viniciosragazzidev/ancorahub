import type { MetaSyncLogItem } from "./types";

/** Rótulo do modo global de captura, compartilhado por /integrations/meta e /marketing/campanhas. */
export const CAPTURE_MODE_LABEL = {
  selective: "Captura seletiva",
  all: "Captura em todos os ativos",
  disabled: "Captura pausada",
} as const;

export type MetaSyncTone = "success" | "warning" | "destructive" | "info" | "secondary";

export type MetaSyncSummary = {
  tone: MetaSyncTone;
  /** Estado em uma palavra: "Concluída", "Parcial", "Falhou"… */
  label: string;
  /** Complemento curto: "há 2 h · 340 itens". Vazio quando não há o que dizer. */
  detail: string;
  /** Data completa (ISO) para tooltip; null quando nunca sincronizou. */
  at: string | null;
};

const RELATIVE_UNITS: Array<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "day", seconds: 86_400 },
  { unit: "hour", seconds: 3_600 },
  { unit: "minute", seconds: 60 },
];

/** "há 5 min", "há 2 h", "ontem", "agora". Puro: recebe `now` para ser testável. */
export function formatRelativeTime(from: Date, now: Date = new Date()): string {
  const diffSeconds = Math.round((now.getTime() - from.getTime()) / 1_000);
  if (diffSeconds < 45) return "agora";
  const formatter = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto", style: "short" });
  for (const { unit, seconds } of RELATIVE_UNITS) {
    if (diffSeconds >= seconds) return formatter.format(-Math.floor(diffSeconds / seconds), unit);
  }
  return formatter.format(-1, "minute");
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Espera progressiva após limite da Meta: 1 h, 2 h, 4 h… até 6 h (mesma regra do serviço de sincronização). */
export const META_RATE_LIMIT_BASE_COOLDOWN_MS = 60 * 60 * 1000;
export const META_RATE_LIMIT_MAX_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export function isMetaRateLimitMessage(errorDetails: string | null | undefined): boolean {
  return typeof errorDetails === "string"
    && /user request limit reached|request limit reached|rate.?limit/i.test(errorDetails);
}

type RateLimitLog = { status: string; errorDetails?: string | null; startedAt: Date | string; completedAt?: Date | string | null };

/**
 * Quando a Meta limitou as últimas sincronizações, devolve até quando o sistema
 * espera antes de tentar de novo; null quando o último registro não é limite.
 */
export function getMetaRateLimitRetryAt(logs: readonly RateLimitLog[]): Date | null {
  const ordered = [...logs]
    .filter((log) => toDate(log.startedAt))
    .sort((a, b) => toDate(b.startedAt)!.getTime() - toDate(a.startedAt)!.getTime());
  let consecutive = 0;
  while (consecutive < ordered.length && ordered[consecutive].status === "error" && isMetaRateLimitMessage(ordered[consecutive].errorDetails)) consecutive += 1;
  if (!consecutive) return null;
  const latest = ordered[0];
  const backoffMs = Math.min(META_RATE_LIMIT_MAX_COOLDOWN_MS, META_RATE_LIMIT_BASE_COOLDOWN_MS * (2 ** (consecutive - 1)));
  return new Date((toDate(latest.completedAt) ?? toDate(latest.startedAt)!).getTime() + backoffMs);
}

function formatBrasiliaClock(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(date);
}

/**
 * Resume a sincronização mais recente em UM estado, para o selo único da tela.
 * Estados gravados pelo serviço de sincronização: success | partial | error | in_progress.
 * Sem nenhum registro, cai para `lastSyncedAt` da conexão.
 */
export function summarizeLastSync(
  logs: readonly (Pick<MetaSyncLogItem, "status" | "itemsSynced" | "startedAt" | "completedAt"> & { errorDetails?: string | null })[],
  lastSyncedAt?: Date | string | null,
  now: Date = new Date(),
): MetaSyncSummary {
  const latest = [...logs]
    .filter((log) => toDate(log.startedAt))
    .sort((a, b) => (toDate(b.startedAt)!.getTime() - toDate(a.startedAt)!.getTime()))[0];

  if (!latest) {
    const fallback = toDate(lastSyncedAt);
    if (!fallback) return { tone: "secondary", label: "Nunca sincronizada", detail: "", at: null };
    return { tone: "success", label: "Concluída", detail: formatRelativeTime(fallback, now), at: fallback.toISOString() };
  }

  const at = toDate(latest.completedAt) ?? toDate(latest.startedAt)!;
  const when = formatRelativeTime(at, now);
  const items = `${latest.itemsSynced} ${latest.itemsSynced === 1 ? "item" : "itens"}`;

  switch (latest.status) {
    case "success":
      return { tone: "success", label: "Concluída", detail: `${when} · ${items}`, at: at.toISOString() };
    case "partial":
      return { tone: "warning", label: "Parcial", detail: `${when} · ${items}`, at: at.toISOString() };
    case "error": {
      // Limite da Meta não é falha do CRM: mostra até quando a sincronização espera.
      const retryAt = getMetaRateLimitRetryAt(logs);
      if (retryAt) {
        return {
          tone: "warning",
          label: "Limitada pela Meta",
          detail: retryAt.getTime() > now.getTime() ? `nova tentativa após ${formatBrasiliaClock(retryAt)}` : `${when} · liberada para tentar`,
          at: at.toISOString(),
        };
      }
      return { tone: "destructive", label: "Falhou", detail: when, at: at.toISOString() };
    }
    case "in_progress":
      return { tone: "info", label: "Em andamento", detail: `iniciada ${when}`, at: at.toISOString() };
    default:
      return { tone: "secondary", label: latest.status, detail: when, at: at.toISOString() };
  }
}
