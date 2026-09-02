import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import LegacyReportsView from "./_components/legacy-reports-view";
import ReportingCenterView from "./_components/reporting-center-view";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; tab?: string }>;
}) {
  const { result } = await withRequestTiming("/relatorios", async () => {
    const [context, reportingCenterEnabled] = await Promise.all([
      getRequiredTenantContext(),
      getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER),
    ]);

    const useNewLayout = reportingCenterEnabled !== "false";

    if (useNewLayout) {
      return <ReportingCenterView context={context} searchParams={searchParams} />;
    }

    return <LegacyReportsView context={context} searchParams={searchParams} />;
  });

  return result;
}
