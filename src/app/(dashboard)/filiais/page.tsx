import { count, eq } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { BranchesManager } from "@/features/branches/components/branches-manager";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export default async function BranchesPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");

  const branches = await getDatabase()
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
      status: schema.branches.status,
      acceptingLeads: schema.branches.acceptingLeads,
    })
    .from(schema.branches)
    .where(eq(schema.branches.tenantId, context.tenantId));

  const memberCounts = await getDatabase()
    .select({ branchId: schema.tenantMemberships.branchId, count: count(schema.tenantMemberships.id) })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.tenantId, context.tenantId))
    .groupBy(schema.tenantMemberships.branchId);
  const countsByBranch = new Map(memberCounts.map((entry) => [entry.branchId, Number(entry.count)]));

  return (
    <>
      <DashboardHeader breadcrumb="Administracao" title="Filiais" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">ESTRUTURA OPERACIONAL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Filiais e unidades</h1>
            <p className="mt-1 text-sm text-muted-foreground">Organize a operacao por unidade, mantenha o escopo de equipe isolado e controle quais filiais podem receber novos leads.</p>
          </div>
        </section>
        <BranchesManager branches={branches.map((branch) => ({ ...branch, externalId: null, memberCount: countsByBranch.get(branch.id) ?? 0, acceptingLeads: branch.acceptingLeads }))} />
      </main>
    </>
  );
}
