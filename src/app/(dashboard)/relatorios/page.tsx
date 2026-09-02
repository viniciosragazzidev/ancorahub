import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
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
  await getRequiredTenantContext();
  const reportingCenterEnabled = await getFeatureFlag(FEATURE_FLAGS.REPORTING_CENTER);

  const useNewLayout = reportingCenterEnabled !== "false";

  if (useNewLayout) {
    return <ReportingCenterView searchParams={searchParams} />;
  }

  return <LegacyReportsView searchParams={searchParams} />;
}
