import { requireRouteAccess } from "@/features/custom-roles/require-route-access";
import PropostasPage from "../propostas/page";
import { and, desc, eq, gte } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { BranchSelect } from "@/components/branch-select";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { parsePeriod, periodStart } from "@/shared/period";
import { SalesWorkspace } from "./sales-workspace";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { buildSalesPageScope } from "@/features/sales/sales-page-scope";
import { isDirectorLitePageOnServer } from "@/features/director-lite/style-flag";
import litePage from "@/components/lite/page/lite-page.module.css";
import { SalesWorkspaceLite } from "./sales-workspace-lite";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; branch?: string; tab?: string }>;
}) {
  // /propostas redireciona para cá com ?tab=propostas (next.config.ts): mostra a tela de propostas, não a de vendas.
  if ((await searchParams).tab === "propostas") {
    await requireRouteAccess("/propostas");
    return PropostasPage();
  }
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const resolvedSearchParams = await searchParams;
  const period = parsePeriod(resolvedSearchParams.period);
  const branchParam = resolvedSearchParams.branch;

  const canFilterBranch = context.role === "director" || context.role === "manager";
  const effectiveBranchId = context.role === "director"
    ? branchParam
    : context.role === "manager"
      ? context.branchId ?? undefined
      : undefined;
  const reportScope = await resolveReportDataScope(context);
  const scope = buildSalesPageScope(context, reportScope, effectiveBranchId);

  const branchesPromise = canFilterBranch
    ? db
        .select({ id: schema.branches.id, name: schema.branches.name })
        .from(schema.branches)
        .where(scope.branchesWhere!)
    : Promise.resolve([] as { id: string; name: string }[]);

  // Build conditions with scope filtering
  const salesPromise = db
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
    .innerJoin(schema.leads, and(eq(schema.sales.leadId, schema.leads.id), eq(schema.sales.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.clients, eq(schema.sales.clientId, schema.clients.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .where(and(scope.salesWhere, gte(schema.sales.saleDate, periodStart(period))))
    .orderBy(desc(schema.sales.createdAt));

  const [branches, sales] = await Promise.all([branchesPromise, salesPromise]);
  const totalRevenue = sales.reduce((sum, row) => sum + Number(row.saleValue), 0);
  // Resumo da barra do topo (anatomia de página), só com as vendas já carregadas acima.
  const pageSummary = `${sales.length.toLocaleString("pt-BR")} ${sales.length === 1 ? "venda" : "vendas"} · ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(totalRevenue)} em ${period} dias`;

  // Chave do diretor: a mesma página no visual Lite (unidade e período vão para a barra da lista).
  if (await isDirectorLitePageOnServer(context, "/vendas")) {
    return (
      <>
        <DashboardHeader breadcrumb="Operação comercial" title="Vendas" summary={pageSummary} />
        <main className={litePage.stack}>
          <SalesWorkspaceLite
            sales={sales.map((s) => ({ ...s, saleValue: Number(s.saleValue), saleDate: s.saleDate.toISOString(), createdAt: s.createdAt.toISOString() }))}
            totalRevenue={totalRevenue}
            currentRole={context.role}
            period={period}
            branches={canFilterBranch ? branches : []}
            branchId={effectiveBranchId}
          />
        </main>
      </>
    );
  }

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Vendas & Fechamentos"
        summary={pageSummary}
        rightSlot={
          <div className="flex items-center gap-2">
            {canFilterBranch ? <BranchSelect branches={branches} value={effectiveBranchId} /> : null}
            <PeriodSelect value={period} />
          </div>
        }
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

      </main>
    </>
  );
}
