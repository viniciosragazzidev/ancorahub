import "server-only";

import { hasCapability } from "@/shared/auth/permissions";
import type { TenantContext } from "@/shared/auth/types";
import type { PeriodValue } from "@/shared/period";
import {
  isReportTab,
  reportTabsForRole,
  type ReportTabId,
} from "@/features/reports/metrics/metric-catalog";
import {
  getAttentionSnapshot,
  getCommercialBySource,
  getCommercialOverview,
  getFinancialOverview,
  getFunnelSnapshot,
  getLeadTimeline,
  getTeamPerformance,
  getUnitPerformance,
} from "@/features/reports/metrics/metrics-service";

/** The URL selects only a tab already permitted by the trusted server context. */
export function resolveExecutiveDashboardTab(
  context: TenantContext,
  rawTab: string | undefined,
): { activeTab: ReportTabId; tabs: readonly ReportTabId[]; includeFinancial: boolean } {
  const includeFinancial = hasCapability(
    context.role,
    "ver_relatorios_financeiros",
    context.jobTitle,
  );
  const tabs = reportTabsForRole(context.role).filter(
    (tab) => tab !== "financial" || includeFinancial,
  );
  const requestedTab = isReportTab(rawTab) ? rawTab : undefined;

  return {
    activeTab: requestedTab && tabs.includes(requestedTab) ? requestedTab : tabs[0] ?? "commercial",
    tabs,
    includeFinancial,
  };
}

/**
 * Server-side adapter for the executive dashboard. It composes the report
 * catalog only; it never owns a query or calculates metrics in the UI.
 */
export async function getExecutiveDashboardData(
  context: TenantContext,
  period: PeriodValue,
  rawTab?: string,
) {
  const { activeTab, tabs, includeFinancial } = resolveExecutiveDashboardTab(context, rawTab);
  const base = { activeTab, tabs, includeFinancial };

  switch (activeTab) {
    case "overview": {
      const [commercial, funnel, attention, timeline] = await Promise.all([
        getCommercialOverview(context, period, { includeFinancial }),
        getFunnelSnapshot(context, period),
        getAttentionSnapshot(context, period),
        getLeadTimeline(context, period),
      ]);
      return { ...base, commercial, funnel, attention, timeline };
    }
    case "commercial": {
      const [commercial, funnel, attention, sourcePerformance] = await Promise.all([
        getCommercialOverview(context, period, { includeFinancial }),
        getFunnelSnapshot(context, period),
        getAttentionSnapshot(context, period),
        getCommercialBySource(context, period, { includeFinancial }),
      ]);
      return { ...base, commercial, funnel, attention, sourcePerformance };
    }
    case "team":
      return {
        ...base,
        teamPerformance: await getTeamPerformance(context, period, { includeFinancial }),
      };
    case "units":
      return { ...base, units: await getUnitPerformance(context, period) };
    case "financial":
      return { ...base, financial: await getFinancialOverview(context, period) };
  }
}

export type ExecutiveDashboardData = Awaited<ReturnType<typeof getExecutiveDashboardData>>;
