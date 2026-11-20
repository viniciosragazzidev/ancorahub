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
import { isOutsideManagerScope } from "@/features/manager-scope/manager-routes";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { LeadQualityCenter } from "@/features/reports/components/lead-quality-center";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { funnelPeriodForOverview, funnelPeriodStart, getQualificationFunnel, parseFunnelPeriod } from "@/features/qualification-turbo/funnel";
import { QualificationFunnelView } from "@/features/qualification-turbo/components/qualification-funnel-view";
import { parseOverviewPeriod } from "@/features/dashboard/overview-filter";
import { shouldUseDirectorLiteStyle } from "@/features/director-lite/style-flag";
import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { DirectorLiteQualificationFunnelPage } from "@/features/dashboard/components/director-lite/qualification-funnel-page";
import { getEssentialDashboard } from "@/features/dashboard/essential/essential-data";
import { parseCustomRange, renderDirectorLiteQuality } from "@/features/dashboard/director-lite-quality-page";
import { customRangeLabel } from "@/features/dashboard/components/director-lite/custom-range";
import { leadQualityWindow } from "@/features/reports/metrics/lead-quality-period";
import { getEntriesByTurn } from "@/features/dashboard/entries/entries-by-turn";
import { getDirectorLiteViewerFirstName } from "@/features/dashboard/director-lite-viewer";
import { liteDashboardTabs } from "@/features/dashboard/director-lite-tabs";
import { hasPermission } from "@/shared/auth/permissions";
import { FunnelInsightsPanel } from "@/features/funnel-insights/components/funnel-insights-panel";
import { getFunnelInsights } from "@/features/funnel-insights/queries";

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
        // 20/11/2026: intervalo e fila no topo (nada de unidade) e entradas por turno, WhatsApp x formulário.
        const queues = await listLeadQualityQueues(context.tenantId);
        const rawQueue = singleParam(resolvedSearchParams.fila);
        const queueId = rawQueue && queues.some((queue) => queue.id === rawQueue) ? rawQueue : null;
        const customRange = parseCustomRange(singleParam(resolvedSearchParams.periodo));
        const range = customRange ? parseLeadQualityPeriod(singleParam(resolvedSearchParams.periodo)) : null;
        const bounds = range ? leadQualityWindow(range) : null;
        const window = bounds ? { since: bounds.since, until: bounds.until ?? new Date() } : null;
        const [funnel, firstName, insights, entries] = await Promise.all([
          getQualificationFunnel(context, funnelPeriod, null, queueId, window),
          getDirectorLiteViewerFirstName(context.userId),
          queueId || window ? Promise.resolve(null) : getFunnelInsights(context, funnelPeriodStart(funnelPeriod), null).catch(() => null),
          getEntriesByTurn(context, range ? { range, queueId } : { period: overviewPeriod, queueId }).catch(() => null),
        ]);
        return <DirectorLiteQualificationFunnelPage data={funnel} branchId={null} branches={[]} queues={queues} queueId={queueId} entries={entries} customRange={customRange} firstName={firstName} now={new Date()} insights={insights ? <FunnelInsightsPanel insights={insights} steps={funnel.stages} /> : null} />;
      }
      const funnelPeriod = parseFunnelPeriod(singleParam(resolvedSearchParams.period));
      const [funnel, insights] = await Promise.all([
        getQualificationFunnel(context, funnelPeriod),
        getFunnelInsights(context, funnelPeriodStart(funnelPeriod)).catch(() => null),
      ]);
      return <QualificationFunnelView data={funnel} showQualityTab {...(insights ? { insights: <FunnelInsightsPanel insights={insights} steps={funnel.stages} /> } : {})} />;
    }
    if (activeTab === "quality" && canReadQuality) {
      // Qualidade no visual Lite (chave ligada), vista Simples. Detalhada e recortes seguem na tela antiga.
      // 20/11/2026: só intervalo e fila; entradas por turno (WhatsApp x formulário). Vistas antigas saíram no Lite.
      if (await shouldUseDirectorLiteStyle(context)) {
        return renderDirectorLiteQuality(context, {
          periodo: singleParam(resolvedSearchParams.periodo),
          fila: singleParam(resolvedSearchParams.fila),
        });
      }
      const focus = parseLeadQualityFocus(
        singleParam(resolvedSearchParams.dimension),
        singleParam(resolvedSearchParams.key),
      );
      const qualityPeriod = parseLeadQualityPeriod(singleParam(resolvedSearchParams.period));
      // Gestor de unidade: o filtro por fila listava as filas da empresa toda; ele vê o relatório da unidade sem esse filtro.
      const queues = isOutsideManagerScope(context.role, context.jobTitle) ? [] : await listLeadQualityQueues(context.tenantId);
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
      // 20/11/2026: intervalo e fila no topo (no lugar da unidade) e entradas por turno, WhatsApp x formulário.
      const queues = await listLeadQualityQueues(context.tenantId);
      const rawQueue = singleParam(resolvedSearchParams.fila);
      const queueId = rawQueue && queues.some((queue) => queue.id === rawQueue) ? rawQueue : null;
      const customRange = parseCustomRange(singleParam(resolvedSearchParams.periodo));
      const range = customRange ? parseLeadQualityPeriod(singleParam(resolvedSearchParams.periodo)) : null;
      const bounds = range ? leadQualityWindow(range) : null;
      const window = bounds && customRange ? { since: bounds.since, until: bounds.until ?? new Date(), label: `entre ${customRangeLabel(customRange)}` } : null;
      const [data, liteReporting, entries] = await Promise.all([
        getEssentialDashboard(context, { period, branchId: null, queueId, window }),
        canReadQuality ? getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER) : Promise.resolve("false"),
        getEntriesByTurn(context, range ? { range, queueId } : { period, queueId }).catch(() => null),
      ]);
      // Abas como no legado: Qualidade e Funil só com a central de qualidade E a central de relatórios ligada.
      const showQualityTabs = canReadQuality && liteReporting !== "false";
      // Só as abas e os links que a tela de hoje já libera para o papel (o visual Lite vale para todo o modo normal).
      const canOpenConversations = hasPermission(context.role, "acessar_conversas") && context.jobTitle !== "marketing";
      return <DirectorLiteDashboard data={data} period={period} branchId={null} branches={[]} queues={queues} queueId={queueId} entries={entries} customRange={customRange} now={new Date()} availableTabs={liteDashboardTabs(context, showQualityTabs)} canOpenConversations={canOpenConversations} />;
    }

    const [data, reportingEnabled] = await Promise.all([
      getCommandCenterData(context),
      canReadQuality ? getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER) : Promise.resolve("false"),
    ]);
    const showQualityTab = canReadQuality && reportingEnabled !== "false";
    // The dashboard is the command center of the day; the period reports live in Relatórios.
    return <CommandCenter data={data} showQualityTab={showQualityTab} canManage={context.role === "director" || context.role === "manager"} unitManager={isOutsideManagerScope(context.role, context.jobTitle)} />;
  });

  return result;
}
