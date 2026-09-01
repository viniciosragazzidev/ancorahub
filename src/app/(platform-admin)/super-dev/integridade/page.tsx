import { desc, count, eq } from "drizzle-orm";

import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getVpsHealth } from "@/lib/server/vps-api";
import { getDatabase, schema } from "@/shared/db";
import { runHealthChecks } from "@/shared/observability/health-matrix";
import { getMetricsSummary } from "@/shared/observability/metrics";

export const dynamic = "force-dynamic";

export default async function SuperDevIntegrityPage() {
  const db = getDatabase();

  const [auditLogsResult, tenantCountResult, leadCountResult, vpsHealthResult, healthMatrixResult, metricsSummaryResult] = await Promise.allSettled([
    db
      .select({
        id: schema.auditLogs.id,
        entidade: schema.auditLogs.entidade,
        acao: schema.auditLogs.acao,
        createdAt: schema.auditLogs.createdAt,
        userName: schema.user.name,
      })
      .from(schema.auditLogs)
      .innerJoin(schema.user, eq(schema.auditLogs.userId, schema.user.id))
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(50),
    db.select({ count: count() }).from(schema.tenants),
    db.select({ count: count() }).from(schema.leads),
    getVpsHealth(),
    runHealthChecks().catch(() => null),
    Promise.resolve(getMetricsSummary(300_000)),
  ]);

  const auditLogs = auditLogsResult.status === "fulfilled" ? auditLogsResult.value : [];
  const tenantCount = tenantCountResult.status === "fulfilled" ? tenantCountResult.value : [];
  const leadCount = leadCountResult.status === "fulfilled" ? leadCountResult.value : [];
  const vpsHealth = vpsHealthResult.status === "fulfilled" ? vpsHealthResult.value : { status: "offline" as const, checkedAt: new Date().toISOString(), latencyMs: 0, errorCode: "timeout" };
  const healthMatrix = healthMatrixResult.status === "fulfilled" ? healthMatrixResult.value : null;
  const metricsSummary = metricsSummaryResult.status === "fulfilled" ? metricsSummaryResult.value : null;

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
      <PlatformAdminHeader breadcrumb="Âncora / Admin" title="Integridade" />
      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        <section className="flex flex-col gap-2">
          <p className="text-xs font-medium text-primary">GOVERNANÇA</p>
          <h1 className="text-2xl font-semibold tracking-tight">Integridade do Sistema</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Métricas de saúde operacional, auditoria global e indicadores de integridade da plataforma.
          </p>
        </section>

        {/* Health Matrix */}
        {healthMatrix && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Health Matrix</CardTitle>
                <CardDescription>Status de cada dependência do sistema em tempo real</CardDescription>
              </div>
              <Badge
                variant={
                  healthMatrix.overall === "HEALTHY"
                    ? "success"
                    : healthMatrix.overall === "DEGRADED"
                      ? "secondary"
                      : "destructive"
                }
                className="gap-1.5"
              >
                <span
                  aria-hidden
                  className={`size-1.5 rounded-full ${
                    healthMatrix.overall === "HEALTHY"
                      ? "bg-success-foreground"
                      : healthMatrix.overall === "DEGRADED"
                        ? "bg-yellow-500"
                        : "bg-destructive-foreground"
                  }`}
                />
                {healthMatrix.overall === "HEALTHY"
                  ? "Saudável"
                  : healthMatrix.overall === "DEGRADED"
                    ? "Degradado"
                    : healthMatrix.overall === "DOWN"
                      ? "Indisponível"
                      : "Desconhecido"}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {healthMatrix.dependencies.map((dep) => (
                  <div
                    key={dep.name}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`size-2 rounded-full ${
                          dep.status === "HEALTHY"
                            ? "bg-green-500"
                            : dep.status === "DEGRADED"
                              ? "bg-yellow-500"
                              : dep.status === "DOWN"
                                ? "bg-red-500"
                                : "bg-gray-400"
                        }`}
                      />
                      <span className="text-sm font-medium capitalize">{dep.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs tabular-nums text-muted-foreground">
                        {dep.avgDurationMs > 0 ? `${dep.avgDurationMs}ms` : "—"}
                      </p>
                      {dep.lastError && (
                        <p className="max-w-[120px] truncate text-[10px] text-destructive">
                          {dep.lastError}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Performance Metrics */}
        {metricsSummary && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Métricas de Performance (últimos 5 min)</CardTitle>
              <CardDescription>Latência e erros das rotas e do banco de dados</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">API Requests</p>
                  <p className="text-xl font-bold tabular-nums">{metricsSummary.api.totalRequests}</p>
                  <p className="text-xs text-muted-foreground">
                    p50: {metricsSummary.api.p50}ms · p95: {metricsSummary.api.p95}ms
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">API Errors</p>
                  <p className={`text-xl font-bold tabular-nums ${metricsSummary.api.errorRate > 1 ? "text-destructive" : ""}`}>
                    {metricsSummary.api.errorRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {metricsSummary.api.errors} de {metricsSummary.api.totalRequests}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">DB Queries</p>
                  <p className="text-xl font-bold tabular-nums">{metricsSummary.db.totalQueries}</p>
                  <p className="text-xs text-muted-foreground">
                    p50: {metricsSummary.db.p50}ms · p95: {metricsSummary.db.p95}ms
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Slow Requests</p>
                  <p className={`text-xl font-bold tabular-nums ${metricsSummary.slowRequests > 0 ? "text-amber-600" : ""}`}>
                    {metricsSummary.slowRequests}
                  </p>
                  <p className="text-xs text-muted-foreground">{'>'} 1s nos últimos 5 min</p>
                </div>
              </div>
              {metricsSummary.api.slowestRoutes.length > 0 && (
                <div className="mt-4 border-t border-border/50 pt-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">ROTAS MAIS LENTAS</p>
                  <div className="space-y-1.5">
                    {metricsSummary.api.slowestRoutes.map((r) => (
                      <div key={r.route} className="flex items-center justify-between text-xs">
                        <span className="font-mono text-muted-foreground">{r.route}</span>
                        <span className="tabular-nums">
                          p95: {r.p95}ms · {r.count} req
                          {r.errors > 0 && <span className="ml-1 text-destructive">({r.errors} err)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Summary */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>Empresas ativas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{tenantCount[0]?.count ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>Total de leads</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{leadCount[0]?.count ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-transparent bg-transparent shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>Eventos auditados</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{auditLogs.length}</p>
              <p className="text-xs text-muted-foreground">Últimos 50 registros</p>
            </CardContent>
          </Card>
        </section>

        <Card className="border-border bg-card shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Infraestrutura VPS</CardTitle>
              <CardDescription>Conexão privada Vercel → Caddy → Fastify</CardDescription>
            </div>
            <Badge variant={vpsHealth.status === "online" ? "success" : "destructive"} className="gap-1.5">
              <span aria-hidden className={vpsHealth.status === "online" ? "size-1.5 rounded-full bg-success-foreground" : "size-1.5 rounded-full bg-destructive-foreground"} />
              {vpsHealth.status === "online" ? "Online" : "Indisponível"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            {vpsHealth.status === "online" ? (
              <>
                <p><span className="font-medium text-foreground">Fastify:</span> OK</p>
                <p><span className="font-medium text-foreground">Última verificação:</span> {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(vpsHealth.checkedAt))}</p>
                <p><span className="font-medium text-foreground">Latência:</span> {vpsHealth.latencyMs} ms</p>
              </>
            ) : (
              <>
                <p><span className="font-medium text-foreground">Último erro:</span> {vpsHealth.errorCode.toUpperCase()}</p>
                <p><span className="font-medium text-foreground">Última verificação:</span> {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(vpsHealth.checkedAt))}</p>
                <p><span className="font-medium text-foreground">Latência:</span> {vpsHealth.latencyMs} ms</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card className="border-transparent bg-transparent shadow-none">
          <CardHeader>
            <CardTitle>Eventos de Auditoria</CardTitle>
            <CardDescription>Registro detalhado de alterações e acessos no sistema</CardDescription>
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
      </main>
    </>
  );
}
