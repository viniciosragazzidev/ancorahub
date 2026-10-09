import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { Suspense } from "react";
import { LightPageSkeleton } from "@/components/light/light-page-skeleton";
import { ChatHomeContent } from "@/features/broker-workspace/components/chat-home-content";
import { getCommandCenterData } from "@/features/dashboard/today";
import { CommandCenter } from "@/features/dashboard/components/command-center";
import { canAccessLeadQualityCenter, getLeadQualityReport, parseLeadQualityFocus } from "@/features/reports/metrics/lead-quality-service";
import { parseLeadQualityPeriod } from "@/features/reports/metrics/lead-quality-period";
import { listLeadQualityQueues } from "@/features/reports/metrics/lead-quality-export";
import { LeadQualityCenter } from "@/features/reports/components/lead-quality-center";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getFeatureFlag } from "@/features/system-settings/queries";

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

    const canReadQuality = await canAccessLeadQualityCenter(context);
    if (activeTab === "quality" && canReadQuality) {
      const focus = parseLeadQualityFocus(
        singleParam(resolvedSearchParams.dimension),
        singleParam(resolvedSearchParams.key),
      );
      const qualityPeriod = parseLeadQualityPeriod(singleParam(resolvedSearchParams.period));
      const queues = await listLeadQualityQueues(context.tenantId);
      const rawQueue = singleParam(resolvedSearchParams.queue);
      const queueId = rawQueue && queues.some((queue) => queue.id === rawQueue) ? rawQueue : null;
      const report = await getLeadQualityReport(context, qualityPeriod, focus, { queueId, origin: null });
      return <LeadQualityCenter report={report} showQualityTab={report.enabled} queues={queues} />;
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
