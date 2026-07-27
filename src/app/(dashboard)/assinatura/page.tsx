import { and, count, eq } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import {
  CreditCard,
  Users,
  Buildings,
  Handshake,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

const planLabels: Record<string, { label: string; features: string[] }> = {
  Essencial: {
    label: "Essencial",
    features: [
      "Até 3 usuários",
      "Gestão de leads",
      "Catálogo de planos",
      "Relatórios básicos",
    ],
  },
  Profissional: {
    label: "Profissional",
    features: [
      "Até 10 usuários",
      "Gestão de leads e vendas",
      "Catálogo de planos",
      "Relatórios avançados",
      "Integração com WhatsApp",
      "Metas comerciais",
    ],
  },
  Corporativo: {
    label: "Corporativo",
    features: [
      "Usuários ilimitados",
      "Todas as funcionalidades",
      "Múltiplas filiais",
      "API e Webhooks",
      "Suporte prioritário",
      "White label",
    ],
  },
};

const statusVariant: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  active: "success",
  inactive: "destructive",
  delinquent: "warning",
};

export default async function SubscriptionPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [tenant] = await db
    .select({
      name: schema.tenants.name,
      legalName: schema.tenants.legalName,
      cnpj: schema.tenants.cnpj,
      subscriptionPlan: schema.tenants.subscriptionPlan,
      status: schema.tenants.status,
      createdAt: schema.tenants.createdAt,
    })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, context.tenantId))
    .limit(1);

  if (!tenant) {
    return (
      <>
        <DashboardHeader breadcrumb="Administração" title="Assinatura" />
        <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
          <p className="text-sm text-muted-foreground">
            Empresa não encontrada.
          </p>
        </main>
      </>
    );
  }

  // Fetch usage stats
  const [userCount, branchCount, leadCount, clientCount] = await Promise.all([
    db
      .select({ count: count() })
      .from(schema.tenantMemberships)
      .where(
        and(
          eq(schema.tenantMemberships.tenantId, context.tenantId),
          eq(schema.tenantMemberships.status, "active"),
        ),
      ),
    db
      .select({ count: count() })
      .from(schema.branches)
      .where(
        and(
          eq(schema.branches.tenantId, context.tenantId),
          eq(schema.branches.status, "active"),
        ),
      ),
    db
      .select({ count: count() })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, context.tenantId)),
    db
      .select({ count: count() })
      .from(schema.clients)
      .where(eq(schema.clients.tenantId, context.tenantId)),
  ]);

  const planInfo =
    planLabels[tenant.subscriptionPlan] ?? {
      label: tenant.subscriptionPlan,
      features: [],
    };

  return (
    <>
      <DashboardHeader breadcrumb="Administração" title="Assinatura" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">ADMINISTRAÇÃO</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Assinatura
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Consulte o plano contratado, limites e estado atual da assinatura
              da corretora.
            </p>
          </div>
        </section>

        {/* Plan Card */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="border-border bg-card shadow-none lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Plano atual</CardTitle>
                  <CardDescription>
                    Sua corretora está no plano {planInfo.label}
                  </CardDescription>
                </div>
                <Badge
                  variant={statusVariant[tenant.status] ?? "secondary"}
                  className="gap-1.5 rounded-md text-xs capitalize"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-40" />
                    <span className="relative inline-flex size-2 rounded-full bg-current" />
                  </span>
                  {tenant.status === "active"
                    ? "Ativo"
                    : tenant.status === "delinquent"
                      ? "Inadimplente"
                      : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
                <p className="text-2xl font-bold tracking-tight">
                  {planInfo.label}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Contratado desde{" "}
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "long",
                  }).format(tenant.createdAt)}
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Funcionalidades inclusas
                </h3>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {planInfo.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-success/10">
                        <span className="size-1.5 rounded-full bg-success" />
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <Button variant="outline" size="sm" disabled>
                  Gerenciar plano
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Uso e limites</CardTitle>
              <CardDescription>
                Consumo atual dos recursos contratados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                {
                  label: "Usuários ativos",
                  value: userCount[0]?.count ?? 0,
                  icon: Users,
                  limit: tenant.subscriptionPlan === "Essencial" ? 3 : 99,
                },
                {
                  label: "Filiais ativas",
                  value: branchCount[0]?.count ?? 0,
                  icon: Buildings,
                  limit: 99,
                },
                {
                  label: "Leads registrados",
                  value: leadCount[0]?.count ?? 0,
                  icon: CreditCard,
                  limit: null,
                },
                {
                  label: "Clientes convertidos",
                  value: clientCount[0]?.count ?? 0,
                  icon: Handshake,
                  limit: null,
                },
              ].map((stat) => {
                const Icon = stat.icon;
                const percentage =
                  stat.limit != null && stat.limit > 0
                    ? Math.round((stat.value / stat.limit) * 100)
                    : null;
                return (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border/40 bg-muted/20 p-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-md bg-primary/10">
                        <Icon className="size-3.5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {stat.label}
                        </p>
                        <p className="text-sm font-semibold">
                          {stat.value}
                          {stat.limit != null && ` / ${stat.limit}`}
                        </p>
                      </div>
                      {percentage != null && (
                        <span
                          className={`text-xs font-medium ${percentage >= 80
                            ? "text-destructive"
                            : percentage >= 60
                              ? "text-warning"
                              : "text-success"
                            }`}
                        >
                          {percentage}%
                        </span>
                      )}
                    </div>
                    {percentage != null && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${percentage >= 80
                            ? "bg-destructive"
                            : percentage >= 60
                              ? "bg-accent"
                              : "bg-success"
                            }`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </section>

        {/* Company Info */}
        <Card className="border-border bg-card shadow-none">
          <CardHeader>
            <CardTitle>Dados da empresa</CardTitle>
            <CardDescription>
              Informações cadastrais da sua corretora
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: "Nome fantasia", value: tenant.name },
                { label: "Razão social", value: tenant.legalName ?? "—" },
                { label: "CNPJ", value: tenant.cnpj ?? "—" },
                { label: "Plano contratado", value: planInfo.label },
                {
                  label: "Status",
                  value:
                    tenant.status === "active"
                      ? "Ativo"
                      : tenant.status === "delinquent"
                        ? "Inadimplente"
                        : "Inativo",
                },
                {
                  label: "Cliente desde",
                  value: new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "long",
                  }).format(tenant.createdAt),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-border/40 bg-muted/20 p-3"
                >
                  <dt className="text-xs text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 text-sm font-medium">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
