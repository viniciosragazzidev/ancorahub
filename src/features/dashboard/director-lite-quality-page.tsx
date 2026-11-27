import "server-only";

import { AttentionDrawerButton } from "@/features/dashboard/components/director-lite/attention-drawer";
import { attentionItems } from "@/features/dashboard/components/director-lite/attention";
import { QualityToolbar, QualityView } from "@/features/dashboard/components/director-lite/quality-view";
import { qualityHeadline } from "@/features/dashboard/components/director-lite/qualidade-funil-text";
import { getEssentialDashboard } from "@/features/dashboard/essential/essential-data";
import { getSimpleLeadQualityReport } from "@/features/reports/metrics/lead-quality-service";
import { DirectorLiteChrome } from "@/features/dashboard/components/director-lite/director-lite-chrome";
import { customRangeLabel, type CustomRange } from "@/features/dashboard/components/director-lite/custom-range";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { isLeadQualityRange, leadQualityWindow, parseLeadQualityPeriod, rangeDays } from "@/features/reports/metrics/lead-quality-period";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { liteDashboardTabs } from "./director-lite-tabs";
import { getDirectorLiteViewerFirstName } from "./director-lite-viewer";

const HEADLINE_PERIOD = { today: "Hoje", "7d": "Nos últimos 7 dias", "30d": "Nos últimos 30 dias" } as const;

/** `?periodo=` com intervalo personalizado ("2026-10-01T08:00_2026-10-13T18:00"), validado como na tela antiga. */
export function parseCustomRange(raw: string | undefined): CustomRange | null {
  if (!raw || !raw.includes("_")) return null;
  const parsed = parseLeadQualityPeriod(raw);
  return isLeadQualityRange(parsed) ? rangeDays(parsed) : null;
}

/**
 * Aba "Qualidade dos leads" (Lite), cópia 1:1 do artifact "Qualidade dos leads e Funil da gestão" (27/11/2026):
 * quatro números, por fila, hora a hora e a estimativa sem os frios (getSimpleLeadQualityReport), com intervalo e
 * fila no topo, "Precisa de você" como na visão geral e Exportar no fim da linha. As entradas por turno (WhatsApp x
 * formulário) seguem na visão geral, em "Entradas por hora".
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
  const qualityPeriod = parseLeadQualityPeriod(customRange ? params.periodo : period === "today" ? "hoje" : period === "7d" ? "7" : "30");
  const bounds = customRange ? leadQualityWindow(qualityPeriod) : null;
  const window = bounds && customRange ? { since: bounds.since, until: bounds.until ?? now, label: `entre ${customRangeLabel(customRange)}` } : null;
  const [report, essential] = await Promise.all([
    getSimpleLeadQualityReport(context, qualityPeriod, { queueId, origin: null }, now),
    getEssentialDashboard(context, { period, branchId: null, queueId, window }, now).catch(() => null),
  ]);
  const periodText = customRange ? `Entre ${customRangeLabel(customRange)}` : HEADLINE_PERIOD[period];
  const legacyPeriod = customRange ? params.periodo ?? "today" : period === "today" ? "today" : period === "7d" ? "7" : "30";
  const legacyHref = `/dashboard?tab=quality&period=${encodeURIComponent(legacyPeriod)}&legado=1`;
  return (
    <DirectorLiteChrome
      now={now}
      tab="quality"
      period={period}
      branchId={null}
      branches={[]}
      queues={queues}
      queueId={queueId}
      customRange={customRange}
      allowCustomRange
      firstName={firstName}
      availableTabs={liteDashboardTabs(context, enabled)}
      headline={qualityHeadline(report, periodText)}
      action={essential ? <AttentionDrawerButton items={attentionItems(essential)} /> : null}
      trailing={<QualityToolbar legacyHref={legacyHref} />}
    >
      <QualityView report={report} unitName={null} now={now} widerHref={`/dashboard?tab=quality&periodo=7${queueId ? `&fila=${encodeURIComponent(queueId)}` : ""}`} />
    </DirectorLiteChrome>
  );
}
