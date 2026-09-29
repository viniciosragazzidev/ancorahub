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
  className,
}: {
  logs: readonly MetaSyncLogItem[];
  lastSyncedAt?: Date | string | null;
  className?: string;
}) {
  const summary = summarizeLastSync(logs, lastSyncedAt);
  const title = summary.at
    ? `Última sincronização: ${new Date(summary.at).toLocaleString("pt-BR")}`
    : "Nenhuma sincronização registrada";

  return (
    <span className={className} title={title} data-slot="meta-sync-badge">
      <Badge variant={summary.tone}>Última sincronização: {summary.label}</Badge>
      {summary.detail ? <span className="ml-2 text-xs text-muted-foreground">{summary.detail}</span> : null}
    </span>
  );
}
