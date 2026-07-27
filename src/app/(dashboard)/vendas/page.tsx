import { and, desc, eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { SalesWorkspace } from "./sales-workspace";

export default async function SalesPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Build conditions with scope filtering
  const conditions = [eq(schema.sales.tenantId, context.tenantId)];

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
      <DashboardHeader breadcrumb="Operação comercial" title="Vendas" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">COMERCIAL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Vendas</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe as vendas realizadas, os cronogramas de repasse e as comissões dos corretores.
            </p>
          </div>
        </div>

        <SalesWorkspace
          sales={sales.map((s) => ({
            ...s,
            saleValue: Number(s.saleValue),
            saleDate: s.saleDate.toISOString(),
            createdAt: s.createdAt.toISOString(),
          }))}
          totalRevenue={totalRevenue}
        />
      </main>
    </>
  );
}
