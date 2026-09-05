import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightDashboard } from "@/features/broker-workspace/components/light-dashboard";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";
import LegacyReportsView from "../relatorios/_components/legacy-reports-view";
import ReportingCenterView from "../relatorios/_components/reporting-center-view";

/**
 * The reporting center is the canonical operational dashboard. The old
 * dashboard variants were split across several surfaces and made the primary
 * route unpredictable; role-aware report tabs are now the single entry point.
 */
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
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

    const reportingCenterEnabled = await getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER);

    if (reportingCenterEnabled !== "false") {
      return <ReportingCenterView context={context} searchParams={searchParams} />;
    }

    return <LegacyReportsView context={context} searchParams={searchParams} />;
  });

  return result;
}
