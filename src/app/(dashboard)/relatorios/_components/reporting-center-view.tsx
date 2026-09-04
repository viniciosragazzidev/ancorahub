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

export default async function ReportingCenterView({
  context,
  searchParams,
}: {
  context: TenantContext;
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  const resolvedParams = await searchParams;
  const period = parsePeriod(resolvedParams.period);
  const activeTab: ReportTabId =
    resolvedParams.tab === "commercial"
      ? "commercial"
      : resolvedParams.tab === "team"
        ? "team"
        : resolvedParams.tab === "units"
          ? "units"
          : resolvedParams.tab === "financial"
            ? "financial"
            : "overview";

  const allowedTabs = reportTabsForRole(context.role);
  const tabs = allowedTabs.filter((tab) => {
    if (tab === "financial") return hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);
    return true;
  });
  const currentTab = tabs.includes(activeTab) ? activeTab : (tabs[0] ?? "commercial");

  const canViewFinancial = hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);

  const needsCommercialContext = currentTab === "overview" || currentTab === "commercial";
  const [commercialOverview, funnel, attention, sourcePerformance, financial, teamPerformance, units] =
    await Promise.all([
      needsCommercialContext
        ? getCommercialOverview(context, period, { includeFinancial: canViewFinancial })
        : Promise.resolve(null),
      needsCommercialContext ? getFunnelSnapshot(context, period) : Promise.resolve(null),
      needsCommercialContext ? getAttentionSnapshot(context, period) : Promise.resolve(null),
      currentTab === "commercial"
        ? getCommercialBySource(context, period, { includeFinancial: canViewFinancial })
        : Promise.resolve(null),
      currentTab === "financial" ? getFinancialOverview(context, period) : Promise.resolve(null),
      currentTab === "team"
        ? getTeamPerformance(context, period, { includeFinancial: canViewFinancial })
        : Promise.resolve(null),
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

        {currentTab === "overview" && commercialOverview && funnel && attention && (
          <OverviewTab
            period={period}
            commercial={commercialOverview}
            funnel={funnel}
            attention={attention}
          />
        )}
        {currentTab === "commercial" && commercialOverview && funnel && attention && sourcePerformance && (
          <CommercialTab
            period={period}
            overview={commercialOverview}
            funnel={funnel}
            attention={attention}
            sourcePerformance={sourcePerformance}
          />
        )}
        {currentTab === "team" && teamPerformance && (
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
