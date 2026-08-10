import { and, desc, eq, gte } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { parsePeriod, periodStart } from "@/shared/period";
import { SalesWorkspace } from "./sales-workspace";
import { RelatedActions } from "@/components/related-actions";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const period = parsePeriod((await searchParams).period);

  // Build conditions with scope filtering
  const conditions = [
    eq(schema.sales.tenantId, context.tenantId),
    gte(schema.sales.saleDate, periodStart(period)),
  ];

  if (context.role === "broker") {
    conditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

  const sales = await db
    .select({
      id: schema.sales.id,
      leadId: schema.sales.leadId,
      leadName: schema.leads.nome,
      clientName: schema.clients.nome,
      brokerId: schema.sales.brokerId,
      brokerName: schema.user.name,
      branchName: schema.branches.name,
      planName: schema.carrierPlans.name,
      carrierName: schema.carriers.name,
      saleDate: schema.sales.saleDate,
      saleValue: schema.sales.saleValue,
      status: schema.sales.status,
      createdAt: schema.sales.createdAt,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .leftJoin(schema.clients, eq(schema.sales.clientId, schema.clients.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .where(and(...conditions))
    .orderBy(desc(schema.sales.createdAt));

  // Get total revenue
  const allValues = await db
    .select({ totalValue: schema.sales.saleValue })
    .from(schema.sales)
    .where(and(...conditions));

  const totalRevenue = allValues.reduce((sum, row) => sum + Number(row.totalValue), 0);

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Vendas & Fechamentos"
        rightSlot={<PeriodSelect value={period} />}
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <SalesWorkspace
          sales={sales.map((s) => ({
            ...s,
            saleValue: Number(s.saleValue),
            saleDate: s.saleDate.toISOString(),
            createdAt: s.createdAt.toISOString(),
          }))}
          totalRevenue={totalRevenue}
          currentRole={context.role}
          period={period}
        />

        <RelatedActions
          title="Navegação Comercial Relacionada"
          description="Acesse funções diretas ligadas a vendas e faturamento."
          links={[
            { label: "Ver Base de Clientes", href: "/clientes", description: "Gestão da carteira de contratos ativos" },
            { label: "Tabela de Comissões", href: "/settings?tab=comissoes", description: "Regras de comissionamento por produto" },
            { label: "Anexar Documentos de Propostas", href: "/documentos", description: "Conferência de documentos e apólices" },
            { label: "Relatório de Desempenho", href: "/relatorios", description: "Métricas de fechamento por corretor" },
          ]}
        />
      </main>
    </>
  );
}
