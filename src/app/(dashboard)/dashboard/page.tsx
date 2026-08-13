import NocDashboardContent from "./_components/noc-dashboard-content";
import MarketingDashboardContent from "./_components/marketing-dashboard-content";
import { BrokerWorkspace } from "./_components/broker-workspace";
import { getBrokerWorkspaceData, isBrokerWorkspaceEnabled } from "@/features/broker-workspace/queries";
import { isCleanUiOperationalEnabled } from "@/features/clean-ui/feature";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";
import { getBrokerDashboardData, getDirectorDashboardData, getManagerDashboardData, getMarketingDashboardData } from "./data";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const period = parsePeriod((await searchParams).period);

  if (context.jobTitle === "marketing") {
    const data = await getMarketingDashboardData(period);
    return <MarketingDashboardContent data={data} period={period} />;
  }

  if (context.role === "director") {
    const data = await getDirectorDashboardData(period);
    return <NocDashboardContent role="director" data={data} period={period} />;
  }
  if (context.role === "manager") {
    return <NocDashboardContent role="manager" data={await getManagerDashboardData(period)} period={period} />;
  }
  if ((await isBrokerWorkspaceEnabled()) && await isCleanUiOperationalEnabled(context.tenantId)) {
    return <BrokerWorkspace data={await getBrokerWorkspaceData()} />;
  }
  return <NocDashboardContent role="broker" data={await getBrokerDashboardData(period)} period={period} />;
}
