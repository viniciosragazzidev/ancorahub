import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightDashboard } from "@/features/broker-workspace/components/light-dashboard";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";
import { getDashboardViewModel } from "@/features/dashboard/service";
import { OperationalDashboard } from "@/features/dashboard/components/operational-dashboard";
import { parsePeriod, type PeriodValue } from "@/shared/period";
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
  const period = parsePeriod(singleParam(resolvedSearchParams.period));
  const activeTab = singleParam(resolvedSearchParams.tab);
  const { result } = await withRequestTiming("/dashboard", async () => {
    const context = await getRequiredTenantContext();

    // The Lite experience is a role-scoped home, not a reporting tab. Resolve it
    // before the shared reporting feature so the broker never falls through to
    // the management dashboard.
    if (context.role === "broker" && (await getExperienceMode(context)) === "LIGHT") {
      const [tenantRows, data] = await Promise.all([
        getDatabase()
          .select({ logoUrl: schema.tenants.logoUrl })
          .from(schema.tenants)
          .where(eq(schema.tenants.id, context.tenantId))
          .limit(1),
        getBrokerWorkspaceData(),
      ]);

      return <LightDashboard data={data} logoUrl={tenantRows[0]?.logoUrl ?? null} />;
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

    const [model, reportingEnabled] = await Promise.all([
      getDashboardViewModel(context, period),
      canReadQuality ? getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER) : Promise.resolve("false"),
    ]);
    const showQualityTab = canReadQuality && reportingEnabled !== "false";
    return <OperationalDashboard model={model} period={period as PeriodValue} showQualityTab={showQualityTab} />;
  });

  return result;
}
