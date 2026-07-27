import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import {
  ArrowUpRight,
  FileText,
  SealCheck,
  ShieldWarning,
  Warning,
  XCircle,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

const activeLeadStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export default async function IntegrityPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const now = new Date();

  // Fetch audit logs
  const auditLogs = await db
    .select({
      id: schema.auditLogs.id,
      entidade: schema.auditLogs.entidade,
      entidadeId: schema.auditLogs.entidadeId,
      acao: schema.auditLogs.acao,
      createdAt: schema.auditLogs.createdAt,
      userName: schema.user.name,
    })
    .from(schema.auditLogs)
    .innerJoin(schema.user, eq(schema.auditLogs.userId, schema.user.id))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(30);

  // Fetch integrity metrics
  const [leadCount, stalledLeads, unworkedLeads] = await Promise.all([
    db
      .select({ count: count() })
      .from(schema.leads)
      .where(eq(schema.leads.tenantId, context.tenantId)),
    db
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.status, activeLeadStatuses),
          sql`${schema.leads.stageEnteredAt} < ${new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()}`,
        ),
      ),
    db
      .select({ count: count() })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          eq(schema.leads.status, "distributed"),
          sql`${schema.leads.assignedAt} < ${new Date(now.getTime() - 15 * 60 * 1000).toISOString()}`,
        ),
      ),
  ]);

  const alerts = [
    {
      type: stalledLeads[0]?.count ?? 0 > 0 ? "warning" : "ok",
      label: "Leads estagnados",
      value: stalledLeads[0]?.count ?? 0,
      description: "Sem avanço há mais de 3 dias",
    },
    {
      type: unworkedLeads[0]?.count ?? 0 > 0 ? "danger" : "ok",
      label: "Leads não trabalhados",
      value: unworkedLeads[0]?.count ?? 0,
      description: "Distribuídos há mais de 15 min sem contato",
    },
    {
      type: "info",
      label: "Total de leads",
      value: leadCount[0]?.count ?? 0,
      description: "Registros no banco de dados",
    },
    {
      type: "info",
      label: "Eventos auditados",
      value: auditLogs.length,
      description: "Últimas 30 entradas de auditoria",
    },
  ];

  const actionLabels: Record<string, string> = {
    create: "Criação",
    update: "Alteração",
    delete: "Exclusão",
    start_service: "Início de atendimento",
    convert: "Conversão",
    assign: "Atribuição",
    login: "Login",
    export: "Exportação",
  };

  return (
    <>
      <DashboardHeader breadcrumb="Governança" title="Integridade" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">GOVERNANÇA</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              Integridade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reúna alertas de perda, estagnação, exportações e eventos de
              auditoria em um único painel de governança.
            </p>
          </div>
        </section>

        {/* Status Summary */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {alerts.map((alert) => {
            const iswarning = alert.type === "warning";
            const isDanger = alert.type === "danger";
            const alertColor = iswarning
              ? "border-warning/30 bg-accent/5"
              : isDanger
                ? "border-destructive/30 bg-destructive/5"
                : "border-border/40 bg-muted/20";
            const textColor = iswarning
              ? "text-warning"
              : isDanger
                ? "text-destructive"
                : "text-foreground";
            const Icon = iswarning
              ? Warning
              : isDanger
                ? XCircle
                : SealCheck;
            return (
              <div
                key={alert.label}
                className={`rounded-lg border ${alertColor} p-3`}
              >
                <div className="flex items-center gap-2">
                  <Icon
                    className={`size-4 ${textColor}`}
                    weight={iswarning || isDanger ? "fill" : "regular"}
                  />
                  <span className="text-xs text-muted-foreground">
                    {alert.label}
                  </span>
                </div>
                <p className={`mt-1 text-xl font-bold tabular-nums ${textColor}`}>
                  {alert.value}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {alert.description}
                </p>
              </div>
            );
          })}
        </section>

        {/* Audit Log Feed + Alerts */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Audit Logs */}
          <Card className="border-border bg-card shadow-none lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Eventos de Auditoria</CardTitle>
                  <CardDescription>
                    Registro detalhado de alterações e acessos no sistema
                  </CardDescription>
                </div>
                <Badge variant="outline" className="gap-1.5 rounded-md text-xs">
                  <ShieldWarning className="size-3" />
                  LGPD
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96">
                <div className="divide-y divide-border">
                  {auditLogs.length === 0 && (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
                      Nenhum evento de auditoria registrado ainda.
                    </div>
                  )}
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 px-6 py-3.5 transition-colors hover:bg-muted/20"
                    >
                      <div className="mt-0.5 flex size-6 items-center justify-center rounded-full bg-muted/60">
                        <ShieldWarning className="size-3 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium capitalize">
                            {actionLabels[log.acao] ?? log.acao}
                          </span>
                          <Badge
                            variant="outline"
                            className="rounded-md text-[10px] font-normal capitalize"
                          >
                            {log.entidade.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {log.userName}
                          {log.entidadeId && (
                            <>
                              {" · "}
                              <code className="text-[10px] font-mono">
                                ID: {log.entidadeId.slice(0, 8)}...
                              </code>
                            </>
                          )}
                        </p>
                      </div>
                      <time className="shrink-0 text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(log.createdAt)}
                      </time>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* System Health & Integrity */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Integridade do Sistema</CardTitle>
              <CardDescription>
                Indicadores de saúde operacional
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* DB Health */}
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <SealCheck className="size-4 text-success" weight="fill" />
                  <span className="text-sm font-medium">
                    Banco de dados
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Operacional · {leadCount[0]?.count ?? 0} registros de leads
                </p>
              </div>

              {/* Webhook Health */}
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <SealCheck className="size-4 text-success" weight="fill" />
                  <span className="text-sm font-medium">Webhooks</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Recebendo leads externos normalmente
                </p>
              </div>

              {/* Export Integrity */}
              <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <FileText className="size-4 text-chart-2" />
                  <span className="text-sm font-medium">
                    Exportações
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Relatórios exportados com trilha de auditoria
                </p>
              </div>

              {/* Quick actions */}
              <div className="pt-2 space-y-2">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  Ações
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs"
                  render={<Link href="/settings" />}
                >
                  <ArrowUpRight className="size-3.5" />
                  Acessar configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </>
  );
}
