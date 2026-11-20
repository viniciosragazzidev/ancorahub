import "server-only";

import { EntriesView } from "@/features/dashboard/components/director-lite/entries-view";
import { DirectorLiteChrome } from "@/features/dashboard/components/director-lite/director-lite-chrome";
import { customRangeLabel, type CustomRange } from "@/features/dashboard/components/director-lite/custom-range";
import { getEntriesByTurn } from "@/features/dashboard/entries/entries-by-turn";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { isLeadQualityRange, parseLeadQualityPeriod, rangeDays } from "@/features/reports/metrics/lead-quality-period";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { liteDashboardTabs } from "./director-lite-tabs";
import { getDirectorLiteViewerFirstName } from "./director-lite-viewer";

const PERIOD_TEXT = { today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" } as const;

/** `?periodo=` com intervalo personalizado ("2026-10-01T08:00_2026-10-13T18:00"), validado como na tela antiga. */
export function parseCustomRange(raw: string | undefined): CustomRange | null {
  if (!raw || !raw.includes("_")) return null;
  const parsed = parseLeadQualityPeriod(raw);
  return isLeadQualityRange(parsed) ? rangeDays(parsed) : null;
}

/**
 * Aba "Qualidade dos leads" (Lite), simplificada em 20/11/2026 a pedido do Vinicios: só intervalo (atalhos ou
 * data e hora personalizadas) e fila no topo; o essencial é quanto entrou por turno (Turno 1 19h–13h30,
 * Turno 2 13h30–19h), separado em WhatsApp e formulário. O CSV exporta a própria tabela.
 */
export async function renderDirectorLiteQuality(context: TenantContext, params: { periodo?: string; unidade?: string; fila?: string }, now = new Date()) {
  const customRange = parseCustomRange(params.periodo);
  const period = parseOverviewPeriod(customRange ? undefined : params.periodo);
  const [queues, enabled, firstName] = await Promise.all([
    listLeadQualityQueues(context.tenantId),
    getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER).then((value) => value !== "false"),
    getDirectorLiteViewerFirstName(context.userId),
  ]);
  const queueId = params.fila && queues.some((queue) => queue.id === params.fila) ? params.fila : null;
  const data = await getEntriesByTurn(context, customRange ? { range: parseLeadQualityPeriod(params.periodo), queueId } : { period, queueId }, now);
  const queueName = queues.find((queue) => queue.id === queueId)?.name ?? null;
  return (
    <DirectorLiteChrome now={now} tab="quality" period={period} branchId={null} branches={[]} queues={queues} queueId={queueId} customRange={customRange} allowCustomRange firstName={firstName} availableTabs={liteDashboardTabs(context, enabled)}>
      <EntriesView data={data} queueName={queueName} periodText={customRange ? customRangeLabel(customRange) : PERIOD_TEXT[period]} current={!customRange} />
    </DirectorLiteChrome>
  );
}
