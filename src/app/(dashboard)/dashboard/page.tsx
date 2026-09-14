import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { withRequestTiming } from "@/shared/observability/request-timing";
import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightDashboard } from "@/features/broker-workspace/components/light-dashboard";
import { getBrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";
import { getDashboardViewModel } from "@/features/dashboard/service";
import { OperationalDashboard } from "@/features/dashboard/components/operational-dashboard";

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

    const model = await getDashboardViewModel(context, 7);
    return <OperationalDashboard model={model} period={7} />;
  });

  return result;
}
