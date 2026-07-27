import { getPlatformTenants, getActiveSessions, getLossRateAlerts, getPlatformAuditLogs } from "@/features/platform-admin/service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PlatformAdminHeader } from "@/components/platform-admin-header";
import { Buildings, ShieldStar, WarningCircle, Clock, ChartLineUp } from "@/components/huge-icons";
import Link from "next/link";

export default async function SuperDevDashboard() {
  const [tenants, sessions, lossAlerts, logs] = await Promise.all([
    getPlatformTenants(),
    getActiveSessions(),
    getLossRateAlerts(),
    getPlatformAuditLogs(),
  ]);

  const activeTenants = tenants.filter(t => t.status === "active").length;

  return (
    <>
      <PlatformAdminHeader breadcrumb="CorreTop / Admin" title="Dashboard de Desenvolvimento" />

      <main className="flex flex-1 flex-col gap-6 p-4 lg:p-6">
        {/* KPI Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Empresas</span>
              <Buildings className="size-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenants.length}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{activeTenants} ativas de {tenants.length}</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Sessões Ativas</span>
              <ShieldStar className="size-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sessions.length}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Dispositivos conectados</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Logs Registrados</span>
              <Clock className="size-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs.length}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Total de eventos auditados</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card shadow-none">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Alertas Ativos</span>
              <WarningCircle className="size-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{lossAlerts.length}</div>
              <p className="text-xs text-muted-foreground mt-0.5">Perdas anormais detectadas</p>
            </CardContent>
          </Card>
        </div>

        {/* Loss Alerts Section (7.3) */}
        {lossAlerts.length > 0 && (
          <Card className="border-warning/30 bg-accent/5 shadow-none">
            <CardHeader className="flex flex-row items-center gap-2">
              <WarningCircle className="size-5 text-warning" />
              <div>
                <CardTitle className="text-sm font-semibold">Alerta de Taxa de Perda Anormal Detectada</CardTitle>
                <CardDescription>Corretores ativos com taxa de conversão perdida acima de 75%.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lossAlerts.map((alert) => (
                <div key={alert.corretorId} className="flex flex-col justify-between rounded-xl border border-warning/20 bg-background/50 p-4 text-xs">
                  <div>
                    <p className="font-semibold text-sm">{alert.corretorNome}</p>
                    <p className="text-muted-foreground">{alert.corretorEmail}</p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase">Total de Leads</p>
                      <p className="font-semibold">{alert.total} atendimentos</p>
                    </div>
                    <Badge variant="warning" className="font-bold">{alert.rate}% perdas</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Quick Actions */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Painel do Super Administrador</CardTitle>
              <CardDescription>Acesse as ferramentas do sistema para gestão global.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Link href="/super-dev/tenants" className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/40 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Empresas e Tenants</p>
                  <p className="text-xs text-muted-foreground">Cadastre e altere status de operadoras parceiras.</p>
                </div>
                <Buildings className="size-4 text-muted-foreground" />
              </Link>

              <Link href="/super-dev/audit" className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/40 transition-colors">
                <div>
                  <p className="font-semibold text-sm">Auditoria e Governança LGPD</p>
                  <p className="text-xs text-muted-foreground">Monitore logs de exportação e revogue consentimentos.</p>
                </div>
                <Clock className="size-4 text-muted-foreground" />
              </Link>
            </CardContent>
          </Card>

          {/* Last Logs Summary */}
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <CardTitle>Atividades recentes</CardTitle>
              <CardDescription>Últimas operações da plataforma.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logs.slice(0, 3).map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-xs">
                  <span className="mt-0.5 rounded bg-muted p-1">
                    <ChartLineUp className="size-3.5" />
                  </span>
                  <div className="flex-1">
                    <p className="font-medium">{log.action}</p>
                    <p className="text-muted-foreground">Por: {log.actorName} ({log.actorEmail})</p>
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt))}
                  </span>
                </div>
              ))}
              {logs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
