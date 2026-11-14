import { and, count, desc, eq, gte, countDistinct } from "drizzle-orm";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { BranchSelect } from "@/components/branch-select";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { parsePeriod, periodStart } from "@/shared/period";
import { ClientesList } from "./clientes-list";
import { ClientesLite } from "./clientes-lite";
import litePage from "@/components/lite/page/lite-page.module.css";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import { buildClientScopeWhere } from "@/features/customers/customer-authorization";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";

import { getExperienceMode } from "@/features/broker-workspace/experience-mode";
import { getLiteAudience } from "@/features/broker-workspace/lite-audience";
import { LightClientsList } from "@/features/broker-workspace/components/light-clients-list";
import { BrokerClientWallet } from "@/features/broker-workspace/components/broker-client-wallet";
import {
  getBrokerClientWallet,
  normalizeBrokerClientWalletFilters,
  shouldUseBrokerClientWalletLite,
} from "@/features/customers/broker-client-wallet";
import { serializeBrokerClientWalletFilters } from "@/features/customers/broker-client-wallet-url";
import { carteiraFichaLiteLigada } from "@/features/carteira/retorno-servico";
import { BrokerMyWallet } from "@/features/broker-workspace/components/broker-my-wallet";
import { isBrokerMyWalletEnabled } from "@/features/customers/broker-my-wallet-flag";
import { isBrokerWalletLeadView, normalizeBrokerWalletFilters } from "@/features/customers/broker-wallet-filters";
import { getBrokerWalletLeads, toBrokerWalletLeadFilters } from "@/features/customers/broker-wallet-leads";
import { createBrokerWalletContactAction } from "@/features/customers/broker-wallet-contact-actions";
import { hasPermission } from "@/shared/auth/permissions";
import { isBrokerPriorClientsEnabled } from "@/features/customers/prior-portfolio";
import { createPriorClientAction } from "@/features/customers/prior-portfolio-actions";
import { saleClientsOnly } from "@/features/customers/prior-portfolio-schema";
import type { TenantContext } from "@/shared/auth/types";

type CustomersSearchParams = {
  period?: string;
  branch?: string;
  view?: string;
  page?: string;
  q?: string;
  origin?: string;
  contract?: string;
  return?: string;
  situacao?: string;
  adicionar?: string;
};

/**
 * Minha carteira (etapa 4a do plano do modo corretor, chaves BROKER_NAV_REORG e BROKER_CLIENT_WALLET_LITE):
 * Clientes e Precisa de atenção vêm de `clients` (DEC-180); Arquivados, de leads. Em atendimento fica em Meus leads.
 */
async function renderBrokerMyWallet(context: TenantContext, searchParams: CustomersSearchParams) {
  // Quem está em atendimento fica em Meus leads: links antigos para "Em negociação" vão para lá.
  if (searchParams.view === "negotiating") redirect("/leads?tab=minha-fila");
  const filters = normalizeBrokerWalletFilters({
    view: searchParams.view,
    page: searchParams.page,
    query: searchParams.q,
    origin: searchParams.origin,
    stage: searchParams.situacao,
    contractStatus: searchParams.contract,
    returnStatus: searchParams.return,
  });
  const leadView = isBrokerWalletLeadView(filters.view);
  // DEC-187: carteira anterior entra com a chave e a migration 0231; sem elas, a carteira é a da etapa 4a.
  const priorPortfolio = await isBrokerPriorClientsEnabled().catch(() => false);
  const [leads, clients] = await Promise.all([
    getBrokerWalletLeads(context, toBrokerWalletLeadFilters(filters, leadView ? (filters.view as "negotiating" | "archived") : "negotiating"), { rows: leadView }),
    getBrokerClientWallet(context, {
      view: leadView ? "all" : (filters.view as "all" | "attention"),
      page: filters.page,
      query: filters.query,
      origin: filters.origin,
      contractStatus: filters.contractStatus,
      returnStatus: filters.returnStatus,
    }, new Date(), { rows: !leadView, priorPortfolio }),
  ]);
  return (
    <BrokerMyWallet
      filters={filters}
      counts={{ negotiating: leads.counts.negotiating, all: clients.counts.all, attention: clients.counts.attention, archived: leads.counts.archived }}
      origins={[...new Set([...leads.origins, ...clients.origins])].sort()}
      leads={leadView ? leads : undefined}
      clients={leadView ? undefined : clients}
      addContactAction={hasPermission(context.role, "criar_lead_manual") ? createBrokerWalletContactAction : undefined}
      addPriorClientAction={priorPortfolio ? createPriorClientAction : undefined}
      openAddContact={searchParams.adicionar === "1"}
    />
  );
}

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<CustomersSearchParams>;
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

  // Gestor and supervisor Lite share the list; buildClientScopeWhere limits each to his unit or team.
  const liteAudience = await getLiteAudience(context);
  if (liteAudience === "supervisor" || liteAudience === "manager") {
    const clients = await db.select({
      id: schema.clients.id,
      name: schema.clients.nome,
      phone: schema.clients.telefone,
      email: schema.clients.email,
      convertedAt: schema.clients.convertedAt,
      brokerName: schema.user.name,
      status: schema.activeCustomers.status,
    }).from(schema.clients)
      .leftJoin(schema.user, eq(schema.clients.corretorId, schema.user.id))
      .leftJoin(schema.activeCustomers, and(eq(schema.activeCustomers.clientId, schema.clients.id), eq(schema.activeCustomers.tenantId, schema.clients.tenantId)))
      .where(and(buildClientScopeWhere(context), saleClientsOnly()))
      .orderBy(desc(schema.clients.convertedAt));
    return <LightClientsList clients={clients} management />;
  }

  const isLightBroker = experienceMode === "LIGHT" && context.role === "broker";
  if (isLightBroker) {
    const flagEnabled = await carteiraFichaLiteLigada();
    if (shouldUseBrokerClientWalletLite({ isLightBroker, flagEnabled })) {
      if (await isBrokerMyWalletEnabled()) return renderBrokerMyWallet(context, resolvedSearchParams);
      const filters = normalizeBrokerClientWalletFilters({
        view: resolvedSearchParams.view as "all" | "attention" | "renewals",
        page: Number(resolvedSearchParams.page),
        query: resolvedSearchParams.q,
        origin: resolvedSearchParams.origin,
        contractStatus: resolvedSearchParams.contract as "active" | "cancelled",
        returnStatus: resolvedSearchParams.return as "overdue" | "today" | "future" | "none",
      });
      const wallet = await getBrokerClientWallet(context, filters);
      if (wallet.filters.view !== filters.view) {
        redirect(`/clientes?${serializeBrokerClientWalletFilters(wallet.filters)}`);
      }
      return <BrokerClientWallet wallet={wallet} filters={wallet.filters} />;
    }

    const clients = await db
      .select({
        id: schema.clients.id,
        name: schema.clients.nome,
        phone: schema.clients.telefone,
        email: schema.clients.email,
        convertedAt: schema.clients.convertedAt,
      })
      .from(schema.clients)
      .where(and(buildClientScopeWhere(context), saleClientsOnly()))
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
      .where(and(clientScope, saleClientsOnly(), gte(schema.clients.convertedAt, periodStartDate)))
      .orderBy(desc(schema.clients.convertedAt)),

    // Total clients
    db
      .select({ total: count() })
      .from(schema.clients)
      .where(and(clientScope, saleClientsOnly(), gte(schema.clients.convertedAt, periodStartDate))),

    // Total leads (for conversion rate)
    db
      .select({ total: count() })
      .from(schema.leads)
      .where(and(leadScope, gte(schema.leads.createdAt, periodStartDate))),

    // Distinct brokers with clients
    db
      .select({ total: countDistinct(schema.clients.corretorId) })
      .from(schema.clients)
      .where(and(clientScope, saleClientsOnly(), gte(schema.clients.convertedAt, periodStartDate))),

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
          saleClientsOnly(),
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

  // Chave do diretor: a mesma carteira no visual Lite (unidade e período vão para a barra da lista).
  if (await isDirectorLitePageOnServer(context, "/clientes")) {
    return (
      <>
        <DashboardHeader breadcrumb="Pós-venda" title="Clientes" />
        <main className={litePage.stack}>
          <ClientesLite
            clients={clients.map((client) => ({
              id: client.id,
              name: client.name,
              phone: client.phone,
              email: client.email,
              convertedAt: new Date(client.convertedAt).toISOString(),
              brokerName: client.brokerName,
              branchName: client.branchName,
            }))}
            metrics={metrics}
            period={period}
            branches={canFilterBranch ? branches : []}
            branchId={branchParam}
          />
        </main>
      </>
    );
  }

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
