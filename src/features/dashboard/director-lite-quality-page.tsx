import "server-only";

import { EntriesView } from "@/features/dashboard/components/director-lite/entries-view";
import { DirectorLiteChrome } from "@/features/dashboard/components/director-lite/director-lite-chrome";
import { getEntriesByTurn } from "@/features/dashboard/entries/entries-by-turn";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { liteDashboardTabs } from "./director-lite-tabs";
import { getDirectorLiteViewerFirstName } from "./director-lite-viewer";

const PERIOD_TEXT = { today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias" } as const;

/**
 * Aba "Qualidade dos leads" (Lite), simplificada em 20/11/2026 a pedido do Vinicios: só intervalo e fila no topo
 * (todas ou uma), e o essencial é quanto entrou por turno, separado em WhatsApp e formulário. As vistas Simples,
 * Detalhada, Intervalo e Exportar antigas saíram; o CSV agora exporta a própria tabela por turno.
 */
export async function renderDirectorLiteQuality(context: TenantContext, params: { periodo?: string; unidade?: string; fila?: string }, now = new Date()) {
  const period = parseOverviewPeriod(params.periodo);
  const [queues, enabled, firstName] = await Promise.all([
    listLeadQualityQueues(context.tenantId),
    getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER).then((value) => value !== "false"),
    getDirectorLiteViewerFirstName(context.userId),
  ]);
  const queueId = params.fila && queues.some((queue) => queue.id === params.fila) ? params.fila : null;
  const data = await getEntriesByTurn(context, { period, queueId }, now);
  const queueName = queues.find((queue) => queue.id === queueId)?.name ?? null;
  return (
    <DirectorLiteChrome now={now} tab="quality" period={period} branchId={null} branches={[]} queues={queues} queueId={queueId} firstName={firstName} availableTabs={liteDashboardTabs(context, enabled)}>
      <EntriesView data={data} queueName={queueName} periodText={PERIOD_TEXT[period]} />
    </DirectorLiteChrome>
  );
}
