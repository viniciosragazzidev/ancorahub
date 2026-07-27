import { desc, count, eq } from "drizzle-orm";

import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getDatabase, schema } from "@/shared/db";

export const dynamic = "force-dynamic";

export default async function SuperDevIntegrityPage() {
  const db = getDatabase();

  const [auditLogs, tenantCount, leadCount] = await Promise.all([
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
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Integridade" />
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
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>Empresas ativas</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{tenantCount[0]?.count ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>Total de leads</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{leadCount[0]?.count ?? 0}</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-2">
              <CardDescription>Eventos auditados</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums">{auditLogs.length}</p>
              <p className="text-xs text-muted-foreground">Últimos 50 registros</p>
            </CardContent>
          </Card>
        </section>

        {/* Audit Logs */}
        <Card className="border-border bg-card shadow-none">
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
