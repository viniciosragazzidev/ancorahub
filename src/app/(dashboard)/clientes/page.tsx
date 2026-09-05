import { and, count, desc, eq, gte, sql, countDistinct } from "drizzle-orm";
import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { BranchSelect } from "@/components/branch-select";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { parsePeriod, periodStart } from "@/shared/period";
import { ClientesList } from "./clientes-list";
import { buildClientScopeWhere } from "@/features/customers/customer-authorization";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";

import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { LightClientsList, type LightClientItem } from "@/features/broker-workspace/components/light-clients-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; branch?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const resolvedSearchParams = await searchParams;
  const period = parsePeriod(resolvedSearchParams.period);
  const branchParam = resolvedSearchParams.branch;

  const canFilterBranch = context.role === "director" || context.role === "manager";

  const branches = canFilterBranch
    ? await db
        .select({ id: schema.branches.id, name: schema.branches.name })
        .from(schema.branches)
        .where(eq(schema.branches.tenantId, context.tenantId))
    : [];

  // Canonical scope filters for Clients and Leads
  const clientScope = buildClientScopeWhere(context, { requestedBranchId: branchParam });
  const leadScope = buildLeadScopeWhere(context, { requestedBranchId: branchParam });

  const periodStartDate = periodStart(period);

  const experienceMode = await getExperienceMode(context);

  if (experienceMode === "LIGHT" && context.role === "broker") {
    const clients = await db
      .select({
        id: schema.clients.id,
        name: schema.clients.nome,
        phone: schema.clients.telefone,
        email: schema.clients.email,
        convertedAt: schema.clients.convertedAt,
      })
      .from(schema.clients)
      .where(buildClientScopeWhere(context))
      .orderBy(desc(schema.clients.convertedAt));

    return <LightClientsList clients={clients} />;
  }

  // Parallel queries for metrics and client list
  const [
    clients,
    [totalClientsResult],
    [totalLeadsResult],
    [brokerCountResult],
    [renewalsResult],
    [recentConversionsResult],
  ] = await Promise.all([
    // Full client list
    db
      .select({
        id: schema.clients.id,
        leadId: schema.clients.leadId,
        name: schema.clients.nome,
        phone: schema.clients.telefone,
        email: schema.clients.email,
        convertedAt: schema.clients.convertedAt,
        brokerName: schema.user.name,
        branchName: schema.branches.name,
      })
      .from(schema.clients)
      .leftJoin(schema.user, eq(schema.clients.corretorId, schema.user.id))
      .leftJoin(schema.branches, eq(schema.clients.branchId, schema.branches.id))
      .where(and(clientScope, gte(schema.clients.convertedAt, periodStartDate)))
      .orderBy(desc(schema.clients.convertedAt)),

    // Total clients
    db
      .select({ total: count() })
      .from(schema.clients)
      .where(and(clientScope, gte(schema.clients.convertedAt, periodStartDate))),

    // Total leads (for conversion rate)
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(and(leadScope, gte(schema.leads.createdAt, periodStartDate))),

    // Distinct brokers with clients
    db
      .select({ total: countDistinct(schema.clients.corretorId) })
      .from(schema.clients)
      .where(and(clientScope, gte(schema.clients.convertedAt, periodStartDate))),

    // Upcoming renewals (clients with active customers whose contract anniversary is within 30 days)
    db
      .select({ total: count() })
      .from(schema.activeCustomers)
      .innerJoin(schema.clients, eq(schema.activeCustomers.clientId, schema.clients.id))
      .where(
        and(
          eq(schema.activeCustomers.tenantId, context.tenantId),
          eq(schema.activeCustomers.status, "active"),
          gte(schema.activeCustomers.contractAnniversary, new Date().toISOString().slice(0, 10)),
          clientScope,
        ),
      ),

    // Clients converted in the last 30 days
    db
      .select({ total: count() })
      .from(schema.clients)
      .where(
        and(
          clientScope,
          gte(schema.clients.convertedAt, periodStartDate),
        ),
      ),
  ]);

  const totalClients = Number(totalClientsResult?.total ?? 0);
  const totalLeads = Number(totalLeadsResult?.total ?? 0);
  const totalBrokers = Number(brokerCountResult?.total ?? 0);
  const upcomingRenewals = Number(renewalsResult?.total ?? 0);
  const recentConversions = Number(recentConversionsResult?.total ?? 0);
  const conversionRate = totalLeads > 0 ? ((totalClients / totalLeads) * 100).toFixed(1) : "0,0";
  const avgClientsPerBroker = totalBrokers > 0 ? Math.round(totalClients / totalBrokers) : totalClients;

  const metrics = {
    totalClients,
    conversionRate,
    avgClientsPerBroker,
    upcomingRenewals,
    recentConversions,
    totalBrokers,
  };

  return (
    <>
      <DashboardHeader
        breadcrumb="Pós-venda"
        title="Clientes"
        rightSlot={
          <div className="flex items-center gap-2">
            <BranchSelect branches={branches} value={branchParam} />
            <PeriodSelect value={period} />
          </div>
        }
      />
      <main className="flex flex-1 flex-col gap-5 p-(--mobile-page-padding) sm:gap-6 lg:p-6">
        <ClientesList clients={clients} metrics={metrics} period={period} />
      </main>
    </>
  );
}
