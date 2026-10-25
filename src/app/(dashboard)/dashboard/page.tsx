import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { Suspense } from "react";
import { LightPageSkeleton } from "@/components/light/light-page-skeleton";
import { ChatHomeContent } from "@/features/broker-workspace/components/chat-home-content";
import { SupervisorHomeContent } from "@/features/supervisor-workspace/supervisor-home-content";
import { ManagerHomeContent } from "@/features/manager-workspace/manager-home-content";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { getCommandCenterData } from "@/features/dashboard/today";
import { CommandCenter } from "@/features/dashboard/components/command-center";
import { canAccessLeadQualityCenter, getLeadQualityReport, getSimpleLeadQualityReport, parseLeadQualityFocus } from "@/features/reports/metrics/lead-quality-service";
import { parseLeadQualityPeriod } from "@/features/reports/metrics/lead-quality-period";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { LeadQualityCenter } from "@/features/reports/components/lead-quality-center";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { funnelPeriodForOverview, getQualificationFunnel, parseFunnelPeriod } from "@/features/qualification-turbo/funnel";
import { QualificationFunnelView } from "@/features/qualification-turbo/components/qualification-funnel-view";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { parseBranchIdParam } from "@/features/reports/metrics/narrow-scope";
import { shouldUseDirectorLiteStyle } from "@/features/director-lite/style-flag";
import { getDashboardUnitFilter, resolveRequestedUnit } from "@/features/dashboard/director-lite-branches";
import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { DirectorLiteQualificationFunnelPage } from "@/features/dashboard/components/director-lite/qualification-funnel-page";
import { getEssentialDashboard } from "@/features/dashboard/essential/essential-data";
import { renderDirectorLiteQuality } from "@/features/dashboard/director-lite-quality-page";
import { getDirectorLiteViewerFirstName } from "@/features/dashboard/director-lite-viewer";
import { liteDashboardTabs } from "@/features/dashboard/director-lite-tabs";
import { hasPermission } from "@/shared/auth/permissions";

type DashboardSearchParams = Record<string, string | string[] | undefined>;

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/**
 * The reporting center is the canonical operational dashboard. The old
 * dashboard variants were split across several surfaces and made the primary
 * route unpredictable; role-aware report tabs are now the single entry point.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeTab = singleParam(resolvedSearchParams.tab);
  const { result } = await withRequestTiming("/dashboard", async () => {
    const context = await getRequiredTenantContext();

    // The Lite experience is a role-scoped home, not a reporting tab. Resolve it
    // before the shared reporting feature so the broker never falls through to
    // the management dashboard.
    if (context.role === "broker" && (await getExperienceMode(context)) === "LIGHT") {
      return (
        <Suspense fallback={<LightPageSkeleton variant="dashboard" />}>
          <ChatHomeContent />
        </Suspense>
      );
    }
    // Supervisor Lite (S2): the team as conversations.
    if (context.role === "supervisor" && (await getLiteAudience(context)) === "supervisor") {
      return (
        <Suspense fallback={<LightPageSkeleton variant="dashboard" />}>
          <SupervisorHomeContent />
        </Suspense>
      );
    }
    if (context.role === "manager" && (await getLiteAudience(context)) === "manager") {
      return (
        <Suspense fallback={<LightPageSkeleton variant="dashboard" />}>
          <ManagerHomeContent />
        </Suspense>
      );
    }

    const canReadQuality = await canAccessLeadQualityCenter(context);
    // Funil de qualificação (qualificação turbo): director and manager with the quality center.
    if (activeTab === "funnel" && canReadQuality && (context.role === "director" || (context.role === "manager" && context.branchId))) {
      if (await shouldUseDirectorLiteStyle(context)) {
        const overviewPeriod = parseOverviewPeriod(singleParam(resolvedSearchParams.periodo) ?? singleParam(resolvedSearchParams.period));
        const funnelPeriod = funnelPeriodForOverview(overviewPeriod);
        const { canCompare, units } = await getDashboardUnitFilter(context);
        const branchId = canCompare ? resolveRequestedUnit(parseBranchIdParam(singleParam(resolvedSearchParams.unidade)), units) : null;
        const [funnel, firstName] = await Promise.all([
          getQualificationFunnel(context, funnelPeriod, branchId),
          getDirectorLiteViewerFirstName(context.userId),
        ]);
        return <DirectorLiteQualificationFunnelPage data={funnel} branchId={branchId} branches={canCompare ? units : []} firstName={firstName} now={new Date()} />;
      }
      const funnelPeriod = parseFunnelPeriod(singleParam(resolvedSearchParams.period));
      const funnel = await getQualificationFunnel(context, funnelPeriod);
      return <QualificationFunnelView data={funnel} showQualityTab />;
    }
    if (activeTab === "quality" && canReadQuality) {
      // Qualidade no visual Lite (chave ligada), vista Simples. Detalhada e recortes seguem na tela antiga.
      const liteQuality = !singleParam(resolvedSearchParams.dimension)
        && singleParam(resolvedSearchParams.vista) !== "detalhada"
        && singleParam(resolvedSearchParams.legado) !== "1"
        && (await shouldUseDirectorLiteStyle(context));
      if (liteQuality) {
        return renderDirectorLiteQuality(context, {
          periodo: singleParam(resolvedSearchParams.periodo),
          unidade: singleParam(resolvedSearchParams.unidade),
        });
      }
      const focus = parseLeadQualityFocus(
        singleParam(resolvedSearchParams.dimension),
        singleParam(resolvedSearchParams.key),
      );
      const qualityPeriod = parseLeadQualityPeriod(singleParam(resolvedSearchParams.period));
      const queues = await listLeadQualityQueues(context.tenantId);
      const rawQueue = singleParam(resolvedSearchParams.queue);
      const queueId = rawQueue && queues.some((queue) => queue.id === rawQueue) ? rawQueue : null;
      const report = await getLeadQualityReport(context, qualityPeriod, focus, { queueId, origin: null });
      // The simple, explained report by default; the detailed analysis on request (or when drilling down).
      const detailed = singleParam(resolvedSearchParams.vista) === "detalhada" || Boolean(focus);
      const simple = report.enabled && !detailed ? await getSimpleLeadQualityReport(context, qualityPeriod, { queueId, origin: null }) : null;
      return <LeadQualityCenter report={report} showQualityTab={report.enabled} queues={queues} simple={simple} />;
    }

    // Painel do diretor no visual Lite (chave feature_director_lite_style). Com a chave desligada, segue a versão de hoje.
    if (activeTab !== "quality" && activeTab !== "funnel" && (await shouldUseDirectorLiteStyle(context))) {
      const period = parseOverviewPeriod(singleParam(resolvedSearchParams.periodo));
      // Só as unidades autorizadas aparecem; sem permissão de comparar, o filtro some. Unidade fora do escopo cai em "Todas".
      const { canCompare, units } = await getDashboardUnitFilter(context);
      const branchId = canCompare ? resolveRequestedUnit(parseBranchIdParam(singleParam(resolvedSearchParams.unidade)), units) : null;
      const data = await getEssentialDashboard(context, { period, branchId });
      // Só as abas e os links que a tela de hoje já libera para o papel (o visual Lite vale para todo o modo normal).
      const canOpenConversations = hasPermission(context.role, "acessar_conversas") && context.jobTitle !== "marketing";
      return <DirectorLiteDashboard data={data} period={period} branchId={branchId} branches={canCompare ? units : []} now={new Date()} availableTabs={liteDashboardTabs(context, canReadQuality)} canOpenConversations={canOpenConversations} />;
    }

    const [data, reportingEnabled] = await Promise.all([
      getCommandCenterData(context),
      canReadQuality ? getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER) : Promise.resolve("false"),
    ]);
    const showQualityTab = canReadQuality && reportingEnabled !== "false";
    // The dashboard is the command center of the day; the period reports live in Relatórios.
    return <CommandCenter data={data} showQualityTab={showQualityTab} canManage={context.role === "director" || context.role === "manager"} />;
  });

  return result;
}
