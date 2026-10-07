import { Badge } from "@/components/ui/badge";
import { summarizeLastSync } from "../meta-sync-status";
import type { MetaSyncLogItem } from "../types";

/**
 * Selo único do status da ÚLTIMA sincronização com a Meta. Substitui a lista de
 * "Sincronizações recentes": quem precisa saber se está tudo em dia lê um estado,
 * não uma tabela de execuções.
 */
export function MetaSyncBadge({
  logs,
  lastSyncedAt,
  canViewError = false,
  className,
}: {
  logs: readonly MetaSyncLogItem[];
  lastSyncedAt?: Date | string | null;
  canViewError?: boolean;
  className?: string;
}) {
  const summary = summarizeLastSync(logs, lastSyncedAt);
  const latest = [...logs]
    .filter((log) => log.startedAt instanceof Date && !Number.isNaN(log.startedAt.getTime()))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];
  const errorDetails = canViewError && latest?.status === "error" ? latest.errorDetails?.trim() : null;
  const safeErrorDetails = errorDetails
    ?.replace(/access_token=[^&\s]+/gi, "access_token=[redigido]")
    .slice(0, 320);
  const title = summary.at
    ? `Última sincronização: ${new Date(summary.at).toLocaleString("pt-BR")}`
    : "Nenhuma sincronização registrada";

  return (
    <div className={`${className ?? ""} flex flex-wrap items-center gap-x-2 gap-y-1`} title={title} data-slot="meta-sync-badge">
      <Badge variant={summary.tone}>Última sincronização: {summary.label}</Badge>
      {summary.detail ? <span className="text-xs text-muted-foreground">{summary.detail}</span> : null}
      {safeErrorDetails ? (
        <details className="basis-full text-xs text-destructive">
          <summary className="w-fit cursor-pointer font-medium">Ver motivo da falha</summary>
          <p className="mt-1 max-w-3xl break-words text-muted-foreground">{safeErrorDetails}</p>
        </details>
      ) : null}
    </div>
  );
}
