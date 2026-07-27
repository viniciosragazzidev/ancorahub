import { and, count, desc, eq, gte, sql, countDistinct } from "drizzle-orm";
import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { ClientesList } from "./clientes-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Scope filter based on role
  const clientScope = context.role === "broker"
    ? eq(schema.clients.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.clients.branchId, context.branchId)
      : undefined;
  const leadScope = context.role === "broker"
    ? eq(schema.leads.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : undefined;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

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
      .where(and(eq(schema.clients.tenantId, context.tenantId), clientScope))
      .orderBy(desc(schema.clients.convertedAt)),

    // Total clients
    db
      .select({ total: count() })
      .from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), clientScope)),

    // Total leads (for conversion rate)
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, context.tenantId), leadScope)),

    // Distinct brokers with clients
    db
      .select({ total: countDistinct(schema.clients.corretorId) })
      .from(schema.clients)
      .where(and(eq(schema.clients.tenantId, context.tenantId), clientScope)),

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
          clientScope ? eq(schema.clients.corretorId, context.userId) : undefined,
        ),
      ),

    // Clients converted in the last 30 days
    db
      .select({ total: count() })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.tenantId, context.tenantId),
          clientScope,
          gte(schema.clients.convertedAt, thirtyDaysAgo),
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
      <DashboardHeader breadcrumb="Pós-venda" title="Clientes" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <ClientesList clients={clients} metrics={metrics} />
      </main>
    </>
  );
}
