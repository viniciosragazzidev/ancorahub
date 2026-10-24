import "server-only";

import { QualityDisabled, QualityView } from "@/features/dashboard/components/director-lite/quality-view";
import { DirectorLiteChrome } from "@/features/dashboard/components/director-lite/director-lite-chrome";
import { getDashboardUnitFilter, resolveRequestedUnit } from "@/features/dashboard/director-lite-branches";
import { parseOverviewPeriod, type OverviewPeriod } from "@/features/dashboard/overview-filter";
import type { LeadQualityPeriod } from "@/features/reports/metrics/lead-quality-period";
import { getSimpleLeadQualityReport } from "@/features/reports/metrics/lead-quality-service";
import { parseBranchIdParam } from "@/features/reports/metrics/narrow-scope";
import { getFeatureFlag } from "@/features/system-settings/queries";
import type { TenantContext } from "@/shared/auth/types";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";

/** Período do topo ("hoje", 7 ou 30 dias) para o período da análise de qualidade. */
const QUALITY_PERIOD: Record<OverviewPeriod, LeadQualityPeriod> = { today: "today", "7d": 7, "30d": 30 };

/**
 * Aba "Qualidade dos leads" no visual Lite, vista Simples. Os números são os de `getSimpleLeadQualityReport`
 * (a mesma consulta da tela antiga), com a unidade do topo (só as autorizadas) e o tenant da sessão.
 */
export async function renderDirectorLiteQuality(context: TenantContext, params: { periodo?: string; unidade?: string }, now = new Date()) {
  const period = parseOverviewPeriod(params.periodo);
  const { canCompare, units } = await getDashboardUnitFilter(context);
  const branchId = canCompare ? resolveRequestedUnit(parseBranchIdParam(params.unidade), units) : null;
  const enabled = (await getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER)) !== "false";
  const report = enabled
    ? await getSimpleLeadQualityReport(context, QUALITY_PERIOD[period], { queueId: null, origin: null, branchId })
    : null;
  const unitName = units.find((unit) => unit.id === branchId)?.name ?? null;
  return (
    <DirectorLiteChrome now={now} tab="quality" period={period} branchId={branchId} branches={canCompare ? units : []}>
      {report ? <QualityView report={report} unitName={unitName} /> : <QualityDisabled />}
    </DirectorLiteChrome>
  );
}
