import { and, count, eq, sql } from "drizzle-orm";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { ViewScopeContext } from "@/components/ownership-context";
import {
  ArrowUpRight,
  ChartBar,
  CurrencyCircleDollar,
  FileArrowDown,
  Target,
  TrendUp,
  Users,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { hasCapability } from "@/shared/auth/permissions";
import { ExportButtons } from "./_components/export-buttons";
import { SpreadsheetSection } from "./_components/spreadsheet-section";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const canExport = hasCapability(context.role, "exportar_relatorios", context.jobTitle);
  const leadScope = context.role === "broker"
    ? eq(schema.leads.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.leads.branchId, context.branchId)
      : undefined;
  const clientScope = context.role === "broker"
    ? eq(schema.clients.corretorId, context.userId)
    : context.role === "manager" && context.branchId
      ? eq(schema.clients.branchId, context.branchId)
      : undefined;

  // Fetch aggregate stats
  const [leadCount, clientCount, saleCount] =
    await Promise.all([
      db
        .select({ count: count() })
        .from(schema.leads)
        .where(and(eq(schema.leads.tenantId, context.tenantId), leadScope)),
      db
        .select({ count: count() })
        .from(schema.clients)
        .where(and(eq(schema.clients.tenantId, context.tenantId), clientScope)),
      db
        .select({ count: count() })
        .from(schema.sales)
        .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
        .where(and(eq(schema.sales.tenantId, context.tenantId), eq(schema.leads.tenantId, context.tenantId), leadScope)),
    ]);

  // Get this month's sales revenue
  const currentMonth = new Date().toISOString().slice(0, 7);
  const monthlyRevenue = await db
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
        sql`to_char(${schema.sales.saleDate}, 'YYYY-MM') = ${currentMonth}`,
      ),
    );

  const totalLeads = leadCount[0]?.count ?? 0;
  const totalClients = clientCount[0]?.count ?? 0;
  const totalSales = saleCount[0]?.count ?? 0;
  const conversionRate =
    totalLeads > 0
      ? ((totalClients / totalLeads) * 100).toFixed(1)
      : "0,0";
  const revenue = parseFloat(monthlyRevenue[0]?.total ?? "0");
  const monthlyLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const reportCards = [
    {
      title: "Relatório de Comissões",
      description:
        "Exporte o cronograma de repasses por período, filial e corretor.",
      icon: CurrencyCircleDollar,
      href: "/vendas",
      action: "Abrir vendas",
      color: "text-chart-2",
    },
    {
      title: "Metas Comerciais",
      description:
        "Acompanhe o progresso das metas por corretor, equipe ou filial.",
      icon: Target,
      href: "/metas",
      action: "Ver metas",
      color: "text-chart-3",
    },
    {
      title: "Funil de Vendas",
      description:
        "Visualize a distribuição de leads por estágio do funil comercial.",
      icon: TrendUp,
      href: "/dashboard",
      action: "Ver dashboard",
      color: "text-chart-4",
    },
    {
      title: "Desempenho da Equipe",
      description:
        "Acompanhe leads, contatos e conversões da equipe em tempo real.",
      icon: Users,
      href: "/equipe",
      action: "Ver equipe",
      color: "text-chart-5",
    },
  ];

  return (
    <>
      <DashboardHeader breadcrumb="Gestão comercial" title="Relatórios" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">
              GESTÃO COMERCIAL
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Relatórios
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consolide indicadores de leads, conversão, produção e desempenho
              da corretora em um só lugar.
            </p>
            <div className="mt-3"><ViewScopeContext role={context.role} /></div>
          </div>
        </section>

        {/* KPI Banner */}
        <section className="rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-5 shadow-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ChartBar className="size-3.5" />
            <span>Resumo do período — {monthlyLabel}</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
            {[
              { label: "Leads", value: totalLeads, color: "text-chart-1" },
              {
                label: "Clientes",
                value: totalClients,
                color: "text-chart-5",
              },
              {
                label: "Vendas",
                value: totalSales,
                color: "text-chart-2",
              },
              {
                label: "Conversão",
                value: `${conversionRate}%`,
                color: "text-chart-4",
              },
              {
                label: "Receita (mês)",
                value: revenue.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }),
                color: "text-success",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg bg-background/60 p-3 text-center backdrop-blur-sm"
              >
                <p className={`text-lg font-bold tabular-nums ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Export Card */}
        {canExport && (
          <Card className="min-w-0 overflow-visible border-border bg-card shadow-none">
            <CardHeader className="min-h-16 py-1">
              <div className="flex items-center gap-2">
                <FileArrowDown className="size-4 text-primary" />
                <div>
                  <CardTitle>Exportação rápida</CardTitle>
                  <CardDescription>
                    Baixe relatórios em CSV para análise externa.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          <CardContent className="min-h-14 pb-4 pt-0">
            <ExportButtons />
          </CardContent>
          </Card>
        )}

        {/* Planilhas importadas */}
        <SpreadsheetSection />

        {/* Report Cards Grid */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {reportCards.map((report) => {
            const Icon = report.icon;
            return (
              <Link
                key={report.title}
                href={report.href}
                className="group relative overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between">
                  <div
                    className={`flex size-10 items-center justify-center rounded-lg ${report.color}/10`}
                  >
                    <Icon className={`size-5 ${report.color}`} />
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
                <h3 className="mt-3 text-sm font-semibold">{report.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {report.description}
                </p>
                <div className="mt-3">
                  <Badge
                    variant="outline"
                    className="rounded-md text-xs font-normal transition-colors group-hover:border-primary/30 group-hover:text-primary"
                  >
                    {report.action}
                  </Badge>
                </div>
              </Link>
            );
          })}
        </section>
      </main>
    </>
  );
}
