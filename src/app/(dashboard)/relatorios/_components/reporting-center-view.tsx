import { unstable_noStore as noStore } from "next/cache";

import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { ViewScopeContext } from "@/components/ownership-context";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { hasCapability } from "@/shared/auth/permissions";
import { parsePeriod } from "@/shared/period";
import type { ReportTabId } from "@/features/reports/metrics/metric-catalog";
import { reportTabsForRole } from "@/features/reports/metrics/metric-catalog";
import {
  getCommercialOverview,
  getCommercialBySource,
  getFunnelSnapshot,
  getAttentionSnapshot,
  getTeamPerformance,
  getUnitPerformance,
  getFinancialOverview,
  resolveWindows,
} from "@/features/reports/metrics/metrics-service";
import { ReportTabs } from "./report-tabs";
import { OverviewTab } from "./overview-tab";
import { CommercialTab } from "./commercial-tab";
import { TeamTab } from "./team-tab";
import { UnitsTab } from "./units-tab";
import { FinancialTab } from "./financial-tab";

export const dynamic = "force-dynamic";

export default async function ReportingCenterView({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  noStore();
  const context = await getRequiredTenantContext();
  const period = parsePeriod((await searchParams).period);
  const activeTab: ReportTabId = (await searchParams).tab === "commercial" ? "commercial"
    : (await searchParams).tab === "team" ? "team"
    : (await searchParams).tab === "units" ? "units"
    : (await searchParams).tab === "financial" ? "financial"
    : "overview";

  const allowedTabs = reportTabsForRole(context.role);
  const tabs = allowedTabs.filter((tab) => {
    if (tab === "financial") return hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);
    return true;
  });
  const currentTab = tabs.includes(activeTab) ? activeTab : "overview";

  const canViewFinancial = hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);

  const { currentStart, previousStart } = resolveWindows(period);

  const [commercialOverview, funnel, attention, sourcePerformance, financial, teamPerformance, units] = await Promise.all([
    getCommercialOverview(context, period, { includeFinancial: canViewFinancial }),
    getFunnelSnapshot(context, period),
    getAttentionSnapshot(context, period),
    getCommercialBySource(context, period, { includeFinancial: canViewFinancial }),
    currentTab === "financial" ? getFinancialOverview(context, period) : Promise.resolve(null),
    currentTab === "team" ? getTeamPerformance(context, period, { includeFinancial: canViewFinancial }) : Promise.resolve(null),
    currentTab === "units" ? getUnitPerformance(context, period) : Promise.resolve(null),
  ]);

  return (
    <>
      <DashboardHeader
        breadcrumb="Gestão comercial"
        title="Relatórios"
        rightSlot={<PeriodSelect value={period} />}
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <ViewScopeContext role={context.role} />

        <ReportTabs tabs={tabs} active={currentTab} period={period} />

        {currentTab === "overview" && (
          <OverviewTab
            period={period}
            commercial={commercialOverview}
            funnel={funnel}
            attention={attention}
          />
        )}
        {currentTab === "commercial" && (
          <CommercialTab
            period={period}
            overview={commercialOverview}
            funnel={funnel}
            attention={attention}
            sourcePerformance={sourcePerformance}
          />
        )}
        {currentTab === "team" && (
          <TeamTab period={period} teamPerformance={teamPerformance} />
        )}
        {currentTab === "units" && (
          <UnitsTab period={period} units={units ?? []} />
        )}
        {currentTab === "financial" && canViewFinancial && financial && (
          <FinancialTab period={period} financial={financial} />
        )}
      </main>
    </>
  );
}
