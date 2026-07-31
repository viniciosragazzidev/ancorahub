import { and, count, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { BranchesManager } from "@/features/branches/components/branches-manager";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export default async function BranchesPage() {
  const context = await getRequiredTenantContext();
  if (context.role !== "director") redirect("/access-denied");

  const db = getDatabase();

  const branches = await db
    .select({
      id: schema.branches.id,
      name: schema.branches.name,
      status: schema.branches.status,
      acceptingLeads: schema.branches.acceptingLeads,
    })
    .from(schema.branches)
    .where(eq(schema.branches.tenantId, context.tenantId));

  const memberCounts = await db
    .select({ branchId: schema.tenantMemberships.branchId, count: count(schema.tenantMemberships.id) })
    .from(schema.tenantMemberships)
    .where(eq(schema.tenantMemberships.tenantId, context.tenantId))
    .groupBy(schema.tenantMemberships.branchId);
  const countsByBranch = new Map(memberCounts.map((entry) => [entry.branchId, Number(entry.count)]));

  // Tendência mensal (últimos 6 meses): filiais criadas e membros vinculados
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const [branchesByMonth, membersByMonth] = await Promise.all([
    db
      .select({ month: sql<string>`to_char(${schema.branches.createdAt}, 'YYYY-MM')`, total: sql<number>`count(*)::int` })
      .from(schema.branches)
      .where(and(eq(schema.branches.tenantId, context.tenantId), sql`${schema.branches.createdAt} >= ${sixMonthsAgo.toISOString()}`))
      .groupBy(sql`to_char(${schema.branches.createdAt}, 'YYYY-MM')`),
    db
      .select({ month: sql<string>`to_char(${schema.tenantMemberships.createdAt}, 'YYYY-MM')`, total: sql<number>`count(*)::int` })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), sql`${schema.tenantMemberships.createdAt} >= ${sixMonthsAgo.toISOString()}`))
      .groupBy(sql`to_char(${schema.tenantMemberships.createdAt}, 'YYYY-MM')`),
  ]);

  function fillMonthSeries(rows: Array<{ month: string; total: number }>) {
    const map = new Map(rows.map((row) => [row.month, Number(row.total)]));
    const result: number[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      result.push(map.get(key) ?? 0);
    }
    return result;
  }

  const branchesTrend = fillMonthSeries(branchesByMonth);
  const membersTrend = fillMonthSeries(membersByMonth);

  return (
    <>
      <DashboardHeader breadcrumb="Administracao" title="Filiais" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        {/* Contexto de página legado, preservado para eventual restauração:
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">ESTRUTURA OPERACIONAL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Filiais e unidades</h1>
            <p className="mt-1 text-sm text-muted-foreground">Organize a operacao por unidade, mantenha o escopo de equipe isolado e controle quais filiais podem receber novos leads.</p>
          </div>
        </section>
        */}
        <BranchesManager
          branches={branches.map((branch) => ({ ...branch, externalId: null, memberCount: countsByBranch.get(branch.id) ?? 0, acceptingLeads: branch.acceptingLeads }))}
          branchesTrend={branchesTrend}
          membersTrend={membersTrend}
        />
      </main>
    </>
  );
}
