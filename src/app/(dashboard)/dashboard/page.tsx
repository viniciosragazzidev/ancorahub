import NocDashboardContent from "./_components/noc-dashboard-content";
import MarketingDashboardContent from "./_components/marketing-dashboard-content";
import { BrokerWorkspace } from "./_components/broker-workspace";
import { getBrokerWorkspaceData, isBrokerWorkspaceEnabled } from "@/features/broker-workspace/queries";
import { isCleanUiOperationalEnabled } from "@/features/clean-ui/feature";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { parsePeriod } from "@/shared/period";
import { getBrokerDashboardData, getDirectorDashboardData, getManagerDashboardData, getMarketingDashboardData } from "./data";

import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightDashboard } from "@/features/broker-workspace/components/light-dashboard";
import { eq } from "drizzle-orm";
import { Suspense } from "react";
import { getDatabase, schema } from "@/shared/db";
import DashboardLoading from "./loading";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent context={context} searchParams={searchParams} />
    </Suspense>
  );
}

async function DashboardContent({
  context,
  searchParams,
}: {
  context: Awaited<ReturnType<typeof getRequiredTenantContext>>;
  searchParams: Promise<{ period?: string }>;
}) {
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

  const mode = await getExperienceMode(context);
  if (mode === "LIGHT") {
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

  const [brokerWorkspaceEnabled, cleanUiEnabled] = await Promise.all([
    isBrokerWorkspaceEnabled(),
    isCleanUiOperationalEnabled(context.tenantId),
  ]);
  if (brokerWorkspaceEnabled && cleanUiEnabled) {
    return <BrokerWorkspace data={await getBrokerWorkspaceData()} />;
  }
  return <NocDashboardContent role="broker" data={await getBrokerDashboardData(period)} period={period} />;
}
