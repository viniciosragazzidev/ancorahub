import { redirect } from "next/navigation";
import { and, asc, eq, sql } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { StatCard } from "@/components/dashboard/metric-card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { isTeamMemberProfileEnabled } from "@/features/team/member-profile";
import { TeamInviteSection } from "./team-invite-section";
import { TeamMembersTable } from "./team-members-table";

export default async function TeamPage() {
  const context = await getRequiredTenantContext();
  if (context.role === "broker") redirect("/access-denied");
  const branchScope = context.role === "manager"
    ? context.branchId ? eq(schema.tenantMemberships.branchId, context.branchId) : sql`false`
    : undefined;
  const branchEntityScope = context.role === "manager"
    ? context.branchId ? eq(schema.branches.id, context.branchId) : sql`false`
    : undefined;
  const leadBranchScope = context.role === "manager"
    ? context.branchId ? eq(schema.leads.branchId, context.branchId) : sql`false`
    : undefined;

  const [tenant, branches, brokers, nonBrokers, unassignedLeads, salesTotal, memberProfileEnabled] = await Promise.all([
    getDatabase()
      .select({ name: schema.tenants.name })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, context.tenantId))
      .limit(1),
    getDatabase()
      .select({ id: schema.branches.id, name: schema.branches.name })
      .from(schema.branches)
      .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active"), branchEntityScope))
      .orderBy(asc(schema.branches.name)),
    getDatabase()
      .select({
        id: sql<string>`coalesce(${schema.tenantMemberships.id}, ${schema.brokerProfiles.id})`,
        userId: schema.brokerProfiles.userId,
        name: schema.brokerProfiles.professionalName,
        email: schema.brokerProfiles.invitedEmail,
        role: sql<"broker">`'broker'`,
        jobTitle: sql<string>`coalesce(${schema.tenantMemberships.jobTitle}, 'broker')`,
        customRoleScope: schema.customRoles.scope,
        status: sql<"pending" | "active" | "disabled">`
          case
            when ${schema.user.status} = 'pending' or ${schema.brokerProfiles.lifecycleStatus} = 'INVITED' then 'pending'::user_status
            when ${schema.user.status} = 'disabled' or ${schema.tenantMemberships.status} = 'inactive' then 'disabled'::user_status
            else 'active'::user_status
          end
        `,
        branchId: sql<string | null>`case when ${schema.tenantMemberships.id} is null then ${schema.brokerProfiles.branchId} else ${schema.tenantMemberships.branchId} end`,
        branchName: schema.branches.name,
      })
      .from(schema.brokerProfiles)
      .leftJoin(schema.branches, eq(schema.brokerProfiles.branchId, schema.branches.id))
      .leftJoin(schema.user, eq(schema.brokerProfiles.userId, schema.user.id))
      .leftJoin(schema.tenantMemberships, and(
        eq(schema.tenantMemberships.userId, schema.brokerProfiles.userId),
        eq(schema.tenantMemberships.tenantId, context.tenantId),
      ))
      .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
      .where(and(
        eq(schema.brokerProfiles.tenantId, context.tenantId),
        context.role === "manager" && context.branchId ? eq(schema.brokerProfiles.branchId, context.branchId) : undefined
      )),
    getDatabase()
      .select({
        id: schema.tenantMemberships.id,
        userId: schema.user.id,
        name: schema.user.name,
        email: schema.user.email,
        role: schema.tenantMemberships.role,
        jobTitle: schema.tenantMemberships.jobTitle,
        customRoleScope: schema.customRoles.scope,
        status: sql<"pending" | "active" | "disabled">`
          case
            when ${schema.user.status} = 'pending' then 'pending'::user_status
            when ${schema.user.status} = 'disabled' or ${schema.tenantMemberships.status} = 'inactive' then 'disabled'::user_status
            else 'active'::user_status
          end
        `,
        branchId: schema.tenantMemberships.branchId,
        branchName: schema.branches.name,
      })
      .from(schema.tenantMemberships)
      .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
      .leftJoin(schema.brokerProfiles, eq(schema.tenantMemberships.userId, schema.brokerProfiles.userId))
      .leftJoin(schema.customRoles, eq(schema.tenantMemberships.customRoleId, schema.customRoles.id))
      .where(and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        branchScope,
        sql`(${schema.tenantMemberships.role} <> 'broker' or ${schema.brokerProfiles.id} is null)`
      )),
    getDatabase()
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.status, "new"), leadBranchScope)),
    getDatabase()
      .select({ sum: sql<number>`coalesce(sum(${schema.sales.saleValue}), 0)::int` })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(and(eq(schema.sales.tenantId, context.tenantId), eq(schema.leads.tenantId, context.tenantId), leadBranchScope)),
    isTeamMemberProfileEnabled(),
  ]);

  // Tendências mensais (últimos 6 meses) para os cards do topo
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  sixMonthsAgo.setHours(0, 0, 0, 0);
  const [membersByMonth, leadsByMonth, salesByMonth] = await Promise.all([
    getDatabase()
      .select({ month: sql<string>`to_char(${schema.tenantMemberships.createdAt}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
      .from(schema.tenantMemberships)
      .where(and(eq(schema.tenantMemberships.tenantId, context.tenantId), sql`${schema.tenantMemberships.createdAt} >= ${sixMonthsAgo.toISOString()}`))
      .groupBy(sql`to_char(${schema.tenantMemberships.createdAt}, 'YYYY-MM')`),
    getDatabase()
      .select({ month: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM')`, count: sql<number>`count(*)::int` })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), leadBranchScope, sql`${schema.leads.createdAt} >= ${sixMonthsAgo.toISOString()}`))
      .groupBy(sql`to_char(${schema.leads.createdAt}, 'YYYY-MM')`),
    getDatabase()
      .select({ month: sql<string>`to_char(${schema.sales.saleDate}, 'YYYY-MM')`, total: sql<number>`coalesce(sum(${schema.sales.saleValue}), 0)::int` })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(and(eq(schema.sales.tenantId, context.tenantId), eq(schema.leads.tenantId, context.tenantId), leadBranchScope, sql`${schema.sales.saleDate} >= ${sixMonthsAgo.toISOString()}`))
      .groupBy(sql`to_char(${schema.sales.saleDate}, 'YYYY-MM')`),
  ]);

  function fillMonthSeries(rows: Array<{ month: string; count?: number; total?: number }>) {
    const map = new Map(rows.map((row) => [row.month, row]));
    const result: number[] = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const row = map.get(key);
      result.push(row ? Number(row.count ?? row.total ?? 0) : 0);
    }
    return result;
  }

  const membersTrend = fillMonthSeries(membersByMonth);
  const leadsTrend = fillMonthSeries(leadsByMonth);
  const salesTrend = fillMonthSeries(salesByMonth);

  const members = [...brokers, ...nonBrokers].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  const activeMembers = members.filter((member) => member.status === "active").length;
  const unassignedCount = unassignedLeads[0]?.count ?? 0;
  const totalVolume = salesTotal[0]?.sum ?? 0;

  return (
    <>
      <DashboardHeader
        breadcrumb={tenant[0]?.name ?? "Gestao"}
        title="Equipe"
        rightSlot={<div className="flex items-center gap-2">{context.role === "director" ? <Button render={<Link href="/equipe/cargos" />} variant="outline">Cargos e permissões</Button> : null}<TeamInviteSection branches={branches} canInviteManager={context.role === "director"} /></div>}
      />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {/* Contexto de página legado, preservado para eventual restauração:
        <section>
          <p className="text-xs font-medium text-primary">GESTAO DE EQUIPE</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Membros da corretora</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            {context.role === "director"
              ? "Crie, edite, desative e exclua acessos de Gestores e Corretores por filial."
              : "Acompanhe os acessos da sua filial, edite corretores e gerencie seus estados operacionais."}
          </p>
        </section>
        */}
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard label="Total de membros" value={members.length} sublabel="últimos 6 meses" sparklineData={membersTrend} sparklineColor="var(--chart-1)" />
          <StatCard label="Acessos ativos" value={activeMembers} sublabel="membros com acesso" sparklineData={membersTrend} sparklineColor="var(--chart-3)" />
          <StatCard label="Leads sem atendimento" value={unassignedCount} sublabel="aguardando corretor" sparklineData={leadsTrend} sparklineColor="var(--chart-4)" />
          <StatCard label="Vendas acumuladas" value={new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalVolume)} sublabel="últimos 6 meses" sparklineData={salesTrend} sparklineColor="var(--chart-2)" />
        </div>
        <TeamMembersTable
          branches={branches}
          currentBranchId={context.branchId}
          currentRole={context.role}
          currentUserId={context.userId}
          members={members}
          canViewProfile={memberProfileEnabled}
        />
      </main>
    </>
  );
}
