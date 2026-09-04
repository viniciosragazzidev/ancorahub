import { unstable_noStore as noStore } from "next/cache";

import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { ViewScopeContext } from "@/components/ownership-context";
import type { TenantContext } from "@/shared/auth/types";
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
} from "@/features/reports/metrics/metrics-service";
import { ReportTabs } from "./report-tabs";
import { OverviewTab } from "./overview-tab";
import { CommercialTab } from "./commercial-tab";
import { TeamTab } from "./team-tab";
import { UnitsTab } from "./units-tab";
import { FinancialTab } from "./financial-tab";
import { withPerfSpan } from "@/shared/observability/request-timing";

export const dynamic = "force-dynamic";

export default async function ReportingCenterView({
  context,
  searchParams,
}: {
  context: TenantContext;
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  noStore();
  const params = await searchParams;
  const period = parsePeriod(params.period);
  const activeTab: ReportTabId = params.tab === "commercial" ? "commercial"
    : params.tab === "team" ? "team"
    : params.tab === "units" ? "units"
    : params.tab === "financial" ? "financial"
    : "overview";

  const allowedTabs = reportTabsForRole(context.role);
  const tabs = allowedTabs.filter((tab) => {
    if (tab === "financial") return hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);
    return true;
  });
  const currentTab = tabs.includes(activeTab) ? activeTab : "overview";

  const canViewFinancial = hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);

  const tabContent = await withPerfSpan("reports.active_tab", async () => {
    switch (currentTab) {
      case "commercial": {
        const [overview, funnel, attention, sourcePerformance] = await Promise.all([
          withPerfSpan("reports.commercial.overview", () => getCommercialOverview(context, period, { includeFinancial: canViewFinancial })),
          withPerfSpan("reports.commercial.funnel", () => getFunnelSnapshot(context, period)),
          withPerfSpan("reports.commercial.attention", () => getAttentionSnapshot(context, period)),
          withPerfSpan("reports.commercial.sources", () => getCommercialBySource(context, period, { includeFinancial: canViewFinancial })),
        ]);
        return <CommercialTab period={period} overview={overview} funnel={funnel} attention={attention} sourcePerformance={sourcePerformance} />;
      }
      case "team": {
        const teamPerformance = await withPerfSpan(
          "reports.team",
          () => getTeamPerformance(context, period, { includeFinancial: canViewFinancial }),
        );
        return <TeamTab period={period} teamPerformance={teamPerformance} />;
      }
      case "units": {
        const units = await withPerfSpan("reports.units", () => getUnitPerformance(context, period));
        return <UnitsTab period={period} units={units} />;
      }
      case "financial": {
        const financial = await withPerfSpan("reports.financial", () => getFinancialOverview(context, period));
        return <FinancialTab period={period} financial={financial} />;
      }
      case "overview": {
        const [commercial, funnel, attention] = await Promise.all([
          withPerfSpan("reports.overview.commercial", () => getCommercialOverview(context, period, { includeFinancial: canViewFinancial })),
          withPerfSpan("reports.overview.funnel", () => getFunnelSnapshot(context, period)),
          withPerfSpan("reports.overview.attention", () => getAttentionSnapshot(context, period)),
        ]);
        return <OverviewTab period={period} commercial={commercial} funnel={funnel} attention={attention} />;
      }
    }
  }, { tab: currentTab });

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

        {tabContent}
      </main>
    </>
  );
}
