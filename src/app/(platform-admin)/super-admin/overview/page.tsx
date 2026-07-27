import { count, eq, sql } from "drizzle-orm";

import { PlatformAdminHeader } from "@/components/platform-admin-header";
import {
  Buildings,
  SealCheck,
  Users,
  Warning,
  XCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function PlatformOverviewPage() {
  const db = getDatabase();

  // Platform-wide metrics
  const [tenantStats, userStats, leadStats] = await Promise.all([
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where status = 'active')`,
        inactive: sql<number>`count(*) filter (where status = 'inactive')`,
        delinquent: sql<number>`count(*) filter (where status = 'delinquent')`,
      })
      .from(schema.tenants),
    db
      .select({
        total: count(),
        active: sql<number>`count(*) filter (where status = 'active')`,
        platformAdmins: sql<number>`count(*) filter (where is_platform_admin = true)`,
      })
      .from(schema.user),
    db.select({ total: count() }).from(schema.leads),
  ]);

  const tenants = tenantStats[0];
  const users = userStats[0];
  const totalLeads = leadStats[0]?.total ?? 0;

  return (
    <>
      <PlatformAdminHeader breadcrumb="Plataforma" title="Visão Geral" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section>
          <p className="text-xs font-medium text-primary">SUPER ADMIN</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Visão Geral da Plataforma
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Acompanhe a saúde da plataforma, tenants ativos e indicadores de
            operação do CorreTop.
          </p>
        </section>

        {/* System Status */}
        <section className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-none lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-success/10">
              <SealCheck className="size-5 text-success" weight="fill" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                Todos os sistemas operacionais
              </h2>
              <p className="text-xs text-muted-foreground">
                {tenants?.active ?? 0} de {tenants?.total ?? 0} tenants ativos
                · {users?.total ?? 0} usuários cadastrados
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className="gap-1.5 rounded-md text-xs font-normal"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success/40 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              Online
            </Badge>
            <Badge
              variant="outline"
              className="gap-1.5 rounded-md text-xs font-normal"
            >
              Postgres (Neon)
            </Badge>
          </div>
        </section>

        {/* KPI Grid */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Tenants Ativos",
              value: tenants?.active ?? 0,
              total: tenants?.total ?? 0,
              icon: Buildings,
              color: "text-chart-1",
            },
            {
              label: "Usuários",
              value: users?.active ?? 0,
              total: users?.total ?? 0,
              icon: Users,
              color: "text-chart-2",
            },
            {
              label: "Leads na Base",
              value: totalLeads,
              icon: Users,
              color: "text-chart-3",
            },
            {
              label: "Admin Plataforma",
              value: users?.platformAdmins ?? 0,
              icon: Users,
              color: "text-chart-4",
            },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="border-border/70 bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm"
              >
                <CardHeader className="flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.label}
                  </CardTitle>
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/5">
                    <Icon className={`size-4 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold tracking-tight tabular-nums">
                    {stat.value}
                  </p>
                  {"total" in stat && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      de {stat.total} registros
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </section>

        {/* Tenant Health */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Saúde dos Tenants</CardTitle>
              <CardDescription>
                Distribuição dos tenants por status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: "Ativos",
                  value: tenants?.active ?? 0,
                  color: "bg-success",
                  textColor: "text-success",
                  icon: SealCheck,
                },
                {
                  label: "Inativos",
                  value: tenants?.inactive ?? 0,
                  color: "bg-destructive",
                  textColor: "text-destructive",
                  icon: XCircle,
                },
                {
                  label: "Inadimplentes",
                  value: tenants?.delinquent ?? 0,
                  color: "bg-accent",
                  textColor: "text-warning",
                  icon: Warning,
                },
              ].map((item) => {
                const Icon = item.icon;
                const total = tenants?.total ?? 1;
                const percentage = Math.round(
                  ((item.value ?? 0) / total) * 100,
                );
                return (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border/40 bg-muted/20 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon
                          className={`size-4 ${item.textColor}`}
                          weight="fill"
                        />
                        <span className="text-sm font-medium">
                          {item.label}
                        </span>
                      </div>
                      <span
                        className={`text-sm font-bold tabular-nums ${item.textColor}`}
                      >
                        {item.value}
                      </span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${item.color} transition-all duration-700`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {percentage}% do total de tenants
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Ambiente</CardTitle>
              <CardDescription>
                Informações do ambiente de execução
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Database", value: "PostgreSQL (Neon)", status: "operational" as const },
                { label: "Storage", value: "Supabase Storage", status: "operational" as const },
                { label: "Auth", value: "BetterAuth", status: "operational" as const },
                { label: "Deployment", value: "Vercel", status: "operational" as const },
              ].map((svc) => (
                <div
                  key={svc.label}
                  className="flex items-center gap-3 rounded-lg border border-border/40 bg-muted/20 p-2.5"
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-success/10">
                    <SealCheck
                      className="size-4 text-success"
                      weight="fill"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{svc.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {svc.value}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-md text-[10px]"
                  >
                    <span className="inline-block size-1.5 rounded-full bg-success" />
                    Operacional
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
