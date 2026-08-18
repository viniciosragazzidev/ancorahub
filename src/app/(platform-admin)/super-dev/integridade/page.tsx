import { desc, count, eq } from "drizzle-orm";

import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getVpsHealth } from "@/lib/server/vps-api";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function SuperDevIntegrityPage() {
  const db = getDatabase();

  const [auditLogs, tenantCount, leadCount, vpsHealth] = await Promise.all([
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
  ]);

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
                <p><span className="font-medium text-foreground">Última verificação:</span> {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(vpsHealth.checkedAt))}</p>
                <p><span className="font-medium text-foreground">Latência:</span> {vpsHealth.latencyMs} ms</p>
              </>
            ) : (
              <>
                <p><span className="font-medium text-foreground">Último erro:</span> {vpsHealth.errorCode.toUpperCase()}</p>
                <p><span className="font-medium text-foreground">Última verificação:</span> {new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" }).format(new Date(vpsHealth.checkedAt))}</p>
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
