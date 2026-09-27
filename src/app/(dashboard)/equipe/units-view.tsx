import { and, count, eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { BranchesManager } from "@/features/branches/components/branches-manager";
import { getBranchDistributionStats } from "@/features/branches/queries";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/tenant-context";
import { TeamManagementTabs } from "./team-management-tabs";

export async function UnitsView({ context }: { context: TenantContext }) {
  const db = getDatabase();
  const branchScope = context.role === "manager" ? context.branchId : undefined;
  const branches = await db.select({
    id: schema.branches.id,
    name: schema.branches.name,
    externalId: schema.branches.externalId,
    status: schema.branches.status,
    acceptingLeads: schema.branches.acceptingLeads,
    autoDistribute: schema.branches.autoDistribute,
    isDistributionHub: schema.branches.isDistributionHub,
  }).from(schema.branches).where(and(
    eq(schema.branches.tenantId, context.tenantId),
    branchScope ? eq(schema.branches.id, branchScope) : undefined,
  )).orderBy(schema.branches.name);

  const [distributionStats, memberCounts] = await Promise.all([
    getBranchDistributionStats(context.tenantId, branches.map((branch) => branch.id)),
    db.select({ branchId: schema.tenantMemberships.branchId, count: count(schema.tenantMemberships.id) })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        branchScope ? eq(schema.tenantMemberships.branchId, branchScope) : undefined,
      )).groupBy(schema.tenantMemberships.branchId),
  ]);
  const countsByBranch = new Map(memberCounts.map((entry) => [entry.branchId, Number(entry.count)]));

  return (
    <>
      <DashboardHeader breadcrumb="Gestão" title="Equipe e unidades" />
      <main className="flex min-h-full flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <TeamManagementTabs active="unidades" />
        <BranchesManager
          branches={branches.map((branch) => {
            const stats = distributionStats.get(branch.id);
            return {
              ...branch,
              memberCount: countsByBranch.get(branch.id) ?? 0,
              availableBrokers: stats?.availableBrokers ?? 0,
              activeLeads: stats?.activeLeads ?? 0,
              newLeads: stats?.newLeads ?? 0,
            };
          })}
          canManage={context.role === "director"}
        />
      </main>
    </>
  );
}
