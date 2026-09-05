import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
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
    const [context, reportingCenterEnabled] = await Promise.all([
      getRequiredTenantContext(),
      getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER),
    ]);

    if (reportingCenterEnabled !== "false") {
      return <ReportingCenterView context={context} searchParams={searchParams} />;
    }

    return <LegacyReportsView context={context} searchParams={searchParams} />;
  });

  return result;
}
