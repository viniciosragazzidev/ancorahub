import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { ViewScopeContext } from "@/components/ownership-context";
import {
  ArrowUpRight,
  ChartBar,
  CurrencyCircleDollar,
  Target,
  TrendUp,
  Users,
} from "@/components/huge-icons";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/metric-card";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasCapability } from "@/shared/auth/permissions";
import { getSupervisedBrokerIds } from "@/features/team/supervisor-service";
import { reportRegistry } from "@/features/reports/report-registry";
import { parsePeriod, periodStart } from "@/shared/period";
import { ReportCenter } from "./_components/report-center";
import { SpreadsheetSection } from "./_components/spreadsheet-section";
import { InternalReportDocuments } from "./_components/internal-report-documents";
import { ReportTrendCharts } from "./_components/report-trend-charts";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const period = parsePeriod((await searchParams).period);
  const reportStart = periodStart(period);
  const canExport = hasCapability(context.role, "exportar_relatorios", context.jobTitle);
  const canGenerateOperational = hasCapability(context.role, "exportar_relatorios_operacionais", context.jobTitle);
  const canViewFinancialReports = hasCapability(context.role, "ver_relatorios_financeiros", context.jobTitle);

  // Parallelize initial scope queries
  const [supervisedBrokerIds, tenantBranches, internalDocuments] = await Promise.all([
    context.role === "supervisor"
      ? getSupervisedBrokerIds(context.tenantId, context.userId)
      : Promise.resolve([]),
    (context.role === "director" || context.role === "manager")
      ? db
          .select({ id: schema.branches.id, name: schema.branches.name })
          .from(schema.branches)
          .where(and(eq(schema.branches.tenantId, context.tenantId), eq(schema.branches.status, "active")))
          .orderBy(schema.branches.name)
      : Promise.resolve([]),
    canExport
      ? db
          .select({
            id: schema.internalReportDocuments.id,
            title: schema.internalReportDocuments.title,
            filename: schema.internalReportDocuments.filename,
            createdAt: schema.internalReportDocuments.createdAt,
          })
          .from(schema.internalReportDocuments)
          .where(eq(schema.internalReportDocuments.tenantId, context.tenantId))
          .orderBy(sql`${schema.internalReportDocuments.createdAt} desc`)
          .limit(20)
      : Promise.resolve([]),
  ]);

  const leadScope =
    context.role === "broker"
      ? eq(schema.leads.corretorId, context.userId)
      : context.role === "supervisor"
        ? supervisedBrokerIds.length
          ? inArray(schema.leads.corretorId, supervisedBrokerIds)
          : eq(schema.leads.id, "__no_supervised_leads__")
      : context.role === "manager" && context.branchId
        ? eq(schema.leads.branchId, context.branchId)
        : undefined;

  const clientScope =
    context.role === "broker"
      ? eq(schema.clients.corretorId, context.userId)
      : context.role === "supervisor"
        ? supervisedBrokerIds.length
          ? inArray(schema.clients.corretorId, supervisedBrokerIds)
          : eq(schema.clients.id, "__no_supervised_clients__")
      : context.role === "manager" && context.branchId
        ? eq(schema.clients.branchId, context.branchId)
        : undefined;

  // Fetch all aggregate stats and day series in a single parallel batch
  const [
    leadCount,
    clientCount,
    saleCount,
    periodRevenue,
    leadsByDay,
    clientsByDay,
    salesByDay,
    revenueByDay,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          leadScope,
          gte(schema.leads.createdAt, reportStart),
        ),
      ),
    db
      .select({ count: count() })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.tenantId, context.tenantId),
          clientScope,
          gte(schema.clients.convertedAt, reportStart),
        ),
      ),
    db
      .select({ count: count() })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.sales.tenantId, context.tenantId),
          eq(schema.leads.tenantId, context.tenantId),
          leadScope,
          gte(schema.sales.saleDate, reportStart),
        ),
      ),
    canViewFinancialReports
      ? db
          .select({
            total: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
          })
          .from(schema.sales)
          .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
          .where(
            and(
              eq(schema.sales.tenantId, context.tenantId),
              eq(schema.leads.tenantId, context.tenantId),
              leadScope,
              eq(schema.sales.status, "active"),
              gte(schema.sales.saleDate, reportStart),
            ),
          )
      : Promise.resolve([{ total: "0" }]),
    db
      .select({
        day: sql<string>`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          leadScope,
          gte(schema.leads.createdAt, reportStart),
        ),
      )
      .groupBy(sql`to_char(${schema.leads.createdAt}, 'YYYY-MM-DD')`),
    db
      .select({
        day: sql<string>`to_char(${schema.clients.convertedAt}, 'YYYY-MM-DD')`,
        count: count(),
      })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.tenantId, context.tenantId),
          clientScope,
          gte(schema.clients.convertedAt, reportStart),
        ),
      )
      .groupBy(sql`to_char(${schema.clients.convertedAt}, 'YYYY-MM-DD')`),
    db
      .select({ day: sql<string>`to_char(${schema.sales.saleDate}, 'YYYY-MM-DD')`, count: count() })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(
        and(
          eq(schema.sales.tenantId, context.tenantId),
          eq(schema.leads.tenantId, context.tenantId),
          leadScope,
          gte(schema.sales.saleDate, reportStart),
        ),
      )
      .groupBy(sql`to_char(${schema.sales.saleDate}, 'YYYY-MM-DD')`),
    canViewFinancialReports
      ? db
          .select({
            day: sql<string>`to_char(${schema.sales.saleDate}, 'YYYY-MM-DD')`,
            total: sql<string>`coalesce(sum(${schema.sales.saleValue}), '0')`,
          })
          .from(schema.sales)
          .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
          .where(
            and(
              eq(schema.sales.tenantId, context.tenantId),
              eq(schema.leads.tenantId, context.tenantId),
              leadScope,
              eq(schema.sales.status, "active"),
              gte(schema.sales.saleDate, reportStart),
            ),
          )
          .groupBy(sql`to_char(${schema.sales.saleDate}, 'YYYY-MM-DD')`)
      : Promise.resolve([]),
  ]);

  function fillDaySeries(rows: Array<{ day: string; count?: number; total?: string }>) {
    const map = new Map(rows.map((row) => [row.day, row]));
    const result: number[] = [];
    for (let i = period - 1; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const row = map.get(key);
      result.push(row ? Number(row.count ?? row.total ?? 0) : 0);
    }
    return result;
  }

  const leadsTrend = fillDaySeries(leadsByDay);
  const clientsTrend = fillDaySeries(clientsByDay);
  const salesTrend = fillDaySeries(salesByDay);
  const revenueTrend = fillDaySeries(revenueByDay);

  const totalLeads = leadCount[0]?.count ?? 0;
  const totalClients = clientCount[0]?.count ?? 0;
  const totalSales = saleCount[0]?.count ?? 0;
  const conversionRate = totalLeads > 0 ? ((totalClients / totalLeads) * 100).toFixed(1) : "0,0";
  const revenue = parseFloat(periodRevenue[0]?.total ?? "0");
  const trendData = leadsTrend.map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (period - 1 - index));

    return {
      date: date.toISOString().slice(0, 10),
      leads: leadsTrend[index] ?? 0,
      clients: clientsTrend[index] ?? 0,
      sales: salesTrend[index] ?? 0,
      revenue: revenueTrend[index] ?? 0,
    };
  });

  const reportCards = [
    {
      title: "Relatório de Comissões",
      description: "Exporte o cronograma de repasses por período, filial e corretor.",
      icon: CurrencyCircleDollar,
      href: "/vendas",
      action: "Abrir vendas",
      color: "text-chart-2",
    },
    {
      title: "Metas Comerciais",
      description: "Acompanhe o progresso das metas por corretor, equipe ou filial.",
      icon: Target,
      href: "/metas",
      action: "Ver metas",
      color: "text-chart-3",
    },
    {
      title: "Funil de Vendas",
      description: "Visualize a distribuição de leads por estágio do funil comercial.",
      icon: TrendUp,
      href: "/dashboard",
      action: "Ver dashboard",
      color: "text-chart-4",
    },
    {
      title: "Desempenho da Equipe",
      description: "Acompanhe leads, contatos e conversões da equipe em tempo real.",
      icon: Users,
      href: "/equipe",
      action: "Ver equipe",
      color: "text-chart-5",
    },
  ];

  return (
    <>
      <DashboardHeader
        breadcrumb="Gestão comercial"
        title="Relatórios"
        rightSlot={<PeriodSelect value={period} />}
      />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <ViewScopeContext role={context.role} />

        <section aria-labelledby="reports-overview-title">
          <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ChartBar className="size-3.5" aria-hidden="true" />
            <h2 id="reports-overview-title" className="font-medium text-foreground">
              Visão do período
            </h2>
            <span aria-hidden="true">•</span>
            <span>Últimos {period} dias</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard
              label="Leads recebidos"
              value={totalLeads}
              sublabel={`Nos últimos ${period} dias`}
              icon={Users}
              iconClassName="bg-chart-1/10 text-chart-1"
              sparklineData={leadsTrend}
              sparklineColor="var(--chart-1)"
            />
            <StatCard
              label="Clientes convertidos"
              value={totalClients}
              sublabel="Leads que viraram clientes"
              icon={Target}
              iconClassName="bg-chart-5/10 text-chart-5"
              sparklineData={clientsTrend}
              sparklineColor="var(--chart-5)"
            />
            <StatCard
              label="Vendas registradas"
              value={totalSales}
              sublabel="Registros do período"
              icon={TrendUp}
              iconClassName="bg-chart-2/10 text-chart-2"
              sparklineData={salesTrend}
              sparklineColor="var(--chart-2)"
            />
            <StatCard
              label="Conversão"
              value={`${conversionRate}%`}
              sublabel="Clientes em relação aos leads"
              icon={ChartBar}
              iconClassName="bg-chart-4/10 text-chart-4"
              sparklineData={leadsTrend.map((value, index) =>
                value > 0 ? Math.round((clientsTrend[index] / value) * 100) : 0,
              )}
              sparklineColor="var(--chart-4)"
            />
            {canViewFinancialReports ? <StatCard
              label="Receita ativa"
              value={revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              sublabel="Vendas ativas no período"
              icon={CurrencyCircleDollar}
              iconClassName="bg-success/10 text-success"
              sparklineData={revenueTrend}
              sparklineColor="var(--success)"
            /> : null}
          </div>
        </section>

        <ReportTrendCharts data={trendData} period={period} showRevenue={canViewFinancialReports} />

        {canGenerateOperational ? (
          <ReportCenter
            reports={reportRegistry}
            branches={tenantBranches}
            userRole={context.role}
            defaultBranchId={context.branchId ?? undefined}
          />
        ) : null}

        {/* Planilhas importadas */}
        <SpreadsheetSection />
        {canExport && <InternalReportDocuments documents={internalDocuments} />}

        <section aria-labelledby="report-shortcuts-title">
          <div className="mb-3">
            <h2 id="report-shortcuts-title" className="text-base font-semibold tracking-tight">
              Análises por área
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acesse os detalhes que explicam os números deste resumo.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {reportCards.map((report) => {
              const Icon = report.icon;
              return (
                <Card key={report.title} variant="compact" className="group p-0">
                  <Link
                    href={report.href}
                    className="flex h-full flex-col p-5 focus-visible:outline-none"
                  >
                    <div className="flex items-start justify-between">
                      <div
                        className={`flex size-10 items-center justify-center rounded-md ${report.color}/10`}
                      >
                        <Icon className={`size-5 ${report.color}`} />
                      </div>
                      <ArrowUpRight className="size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
                    </div>
                    <h3 className="mt-3 text-sm font-semibold">{report.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {report.description}
                    </p>
                    <span className="mt-4 text-xs font-medium text-primary">{report.action}</span>
                  </Link>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </>
  );
}
