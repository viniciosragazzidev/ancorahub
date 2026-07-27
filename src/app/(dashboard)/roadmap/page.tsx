import {
  CalendarBlank,
  CheckCircle,
  Circle,
  Clock,
  Flag,
  WarningCircle,
} from "@/components/huge-icons";
import { redirect } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { newRoadmapItems, roadmapDays, roadmapItems, type RoadmapStatus } from "@/features/roadmap/roadmap-data";
import { getSystemSettings } from "@/features/system-settings/queries";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { and, eq, inArray, isNull, lt, asc } from "drizzle-orm";
import { updateSystemSettingsAction } from "./actions";

const statusConfig: Record<RoadmapStatus, { label: string; icon: typeof Circle; className: string }> = {
  done: { label: "Feito", icon: CheckCircle, className: "text-emerald-500" },
  partial: { label: "Em andamento", icon: Clock, className: "text-amber-500" },
  planned: { label: "Planejado", icon: Circle, className: "text-muted-foreground" },
  external: { label: "Dependencia externa", icon: WarningCircle, className: "text-sky-500" },
};

const priorityClass = {
  P0: "border-destructive/40 text-destructive",
  P1: "border-amber-500/40 text-amber-500",
  P2: "border-muted-foreground/30 text-muted-foreground",
  "Risco externo": "border-sky-500/40 text-sky-500",
} as const;

function formatRelativeTime(date: Date | null) {
  if (!date) return "Sem dados";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);

  if (diffMin < 60) return `Há ${diffMin} min`;
  if (diffHrs < 24) return `Há ${diffHrs} ${diffHrs === 1 ? "hora" : "horas"}`;
  return `Há ${diffDays} ${diffDays === 1 ? "dia" : "dias"}`;
}

export default async function RoadmapPage() {
  redirect("/dashboard");
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Get user platform admin role
  const [dbUser] = await db
    .select({ isPlatformAdmin: schema.user.isPlatformAdmin })
    .from(schema.user)
    .where(eq(schema.user.id, context.userId));
  const isSuperAdmin = dbUser?.isPlatformAdmin ?? false;

  // Load system settings
  const settingsList = await getSystemSettings();
  const settingsMap = new Map(settingsList.map((s) => [s.key, s.value]));

  const centralAtencaoEnabled = settingsMap.get("feature_central_atencao_enabled") !== "false"; // default true
  const stagnantDaysStr = settingsMap.get("feature_central_atencao_stagnant_days") ?? "3";
  const stagnantDays = parseInt(stagnantDaysStr, 10);

  // Queries for live dashboard widget (only if enabled)
  let leadsSemContatoCount = 0;
  let leadsSemContatoAge: Date | null = null;
  let leadsEstagnadosCount = 0;
  let leadsEstagnadosAge: Date | null = null;
  let tarefasVencidasCount = 0;
  let tarefasVencidasAge: Date | null = null;
  let documentosPendentesCount = 0;
  let documentosPendentesAge: Date | null = null;
  let integracoesProblemaCount = 0;
  let integracoesProblemaAge: Date | null = null;

  if (centralAtencaoEnabled) {
    // 1. Leads sem contato
    const leadsSemContato = await db
      .select({ createdAt: schema.leads.createdAt })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.status, ["new", "distributed"]),
          isNull(schema.leads.serviceStartedAt)
        )
      )
      .orderBy(asc(schema.leads.createdAt));

    leadsSemContatoCount = leadsSemContato.length;
    if (leadsSemContatoCount > 0) {
      leadsSemContatoAge = leadsSemContato[0].createdAt;
    }

    // 2. Leads estagnados
    const threeDaysAgo = new Date(Date.now() - stagnantDays * 24 * 60 * 60 * 1000);
    const leadsEstagnados = await db
      .select({ stageEnteredAt: schema.leads.stageEnteredAt })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, context.tenantId),
          inArray(schema.leads.status, ["new", "distributed", "in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"]),
          lt(schema.leads.stageEnteredAt, threeDaysAgo)
        )
      )
      .orderBy(asc(schema.leads.stageEnteredAt));

    leadsEstagnadosCount = leadsEstagnados.length;
    if (leadsEstagnadosCount > 0) {
      leadsEstagnadosAge = leadsEstagnados[0].stageEnteredAt;
    }

    // 3. Tarefas vencidas
    const now = new Date();
    const tarefasVencidas = await db
      .select({ dueAt: schema.leadTasks.dueAt })
      .from(schema.leadTasks)
      .where(
        and(
          eq(schema.leadTasks.tenantId, context.tenantId),
          isNull(schema.leadTasks.completedAt),
          lt(schema.leadTasks.dueAt, now)
        )
      )
      .orderBy(asc(schema.leadTasks.dueAt));

    tarefasVencidasCount = tarefasVencidas.length;
    if (tarefasVencidasCount > 0) {
      tarefasVencidasAge = tarefasVencidas[0].dueAt;
    }

    // 4. Documentos pendentes
    const documentosPendentes = await db
      .select({ createdAt: schema.leadDocuments.createdAt })
      .from(schema.leadDocuments)
      .where(
        and(
          eq(schema.leadDocuments.tenantId, context.tenantId),
          eq(schema.leadDocuments.status, "pending")
        )
      )
      .orderBy(asc(schema.leadDocuments.createdAt));

    documentosPendentesCount = documentosPendentes.length;
    if (documentosPendentesCount > 0) {
      documentosPendentesAge = documentosPendentes[0].createdAt;
    }

    // 5. Integrações com problema
    const integracoesProblema = await db
      .select({ receivedAt: schema.webhookDeliveries.receivedAt })
      .from(schema.webhookDeliveries)
      .where(
        and(
          eq(schema.webhookDeliveries.tenantId, context.tenantId),
          inArray(schema.webhookDeliveries.status, ["failed", "rejected"])
        )
      )
      .orderBy(asc(schema.webhookDeliveries.receivedAt));

    integracoesProblemaCount = integracoesProblema.length;
    if (integracoesProblemaCount > 0) {
      integracoesProblemaAge = integracoesProblema[0].receivedAt;
    }
  }

  const done = roadmapItems.filter((item) => item.status === "done").length;
  const partial = roadmapItems.filter((item) => item.status === "partial").length;
  const progress = Math.round(((done + partial * 0.5) / roadmapItems.length) * 100);

  return (
    <>
      <DashboardHeader breadcrumb="Planejamento" title="Roadmap de desenvolvimento" />
      <main className="flex min-h-full flex-col gap-6 bg-background p-4 lg:p-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card className="border-border bg-card shadow-none">
            <CardHeader>
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
                <CalendarBlank size={15} /> Plano oficial de 7 dias
              </div>
              <CardTitle className="mt-2 text-2xl">CorreTop em construcao</CardTitle>
              <CardDescription className="max-w-2xl">Acompanhe tudo que foi definido no plano, o que ja esta funcionando e os proximos blocos para chegar ao primeiro go-live.</CardDescription>
            </CardHeader>
          </Card>
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-2"><CardDescription>Progresso ponderado</CardDescription><CardTitle className="font-mono text-4xl">{progress}%</CardTitle></CardHeader>
            <CardContent>
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground transition-[width] duration-500" style={{ width: `${progress}%` }} /></div>
              <p className="mt-2 text-xs text-muted-foreground">{done} feitos · {partial} em andamento · {roadmapItems.length - done - partial} planejados</p>
            </CardContent>
          </Card>
        </section>

        {isSuperAdmin && (
          <Card className="border-border bg-card shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Controle de Features (Super-Admin)</CardTitle>
              <CardDescription className="text-xs">
                Ative, desative ou edite os parâmetros da Central de Atenção sob demanda.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form action={updateSystemSettingsAction} className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Central de Atenção</span>
                  <select
                    name="centralAtencaoEnabled"
                    defaultValue={centralAtencaoEnabled ? "true" : "false"}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="true">Ativada (Live)</option>
                    <option value="false">Desativada</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">Dias para Estagnação</span>
                  <input
                    type="number"
                    name="stagnantDays"
                    min="1"
                    defaultValue={stagnantDays}
                    className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-foreground px-4 py-1.5 text-xs font-semibold text-background hover:bg-foreground/90"
                >
                  Salvar
                </button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="mr-1 font-medium text-foreground">Legenda</span>
          {(Object.entries(statusConfig) as Array<[RoadmapStatus, (typeof statusConfig)[RoadmapStatus]]>).map(([status, config]) => {
            const Icon = config.icon;
            return <span key={status} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1"><Icon size={13} className={config.className} />{config.label}</span>;
          })}
        </div>

        <Tabs className="gap-5" defaultValue="implemented">
          <TabsList aria-label="Visões do roadmap" className="w-full justify-start sm:w-fit">
            <TabsTrigger value="implemented">Implementados</TabsTrigger>
            <TabsTrigger value="new">Novas <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">{newRoadmapItems.length}</Badge></TabsTrigger>
          </TabsList>

          <TabsContent className="space-y-6" value="implemented">
            {roadmapDays.map((day) => {
              const dayDone = day.items.filter((item) => item.status === "done").length;
              return (
                <section key={day.day} className="space-y-3">
                  <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Dia {day.day}</p>
                      <h2 className="mt-1 text-lg font-semibold tracking-tight">{day.title}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">{day.objective}</p>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{dayDone}/{day.items.length} feitos</span>
                  </div>
                  <div className="grid gap-2">
                    {day.items.map((roadmapItem) => {
                      const config = statusConfig[roadmapItem.status];
                      const Icon = config.icon;
                      return (
                        <Card key={roadmapItem.id} size="sm" className="border-border bg-card shadow-none transition-colors hover:bg-muted/30">
                          <CardContent className="flex items-start gap-3 py-4">
                            <Icon size={20} weight={roadmapItem.status === "done" ? "fill" : "regular"} className={`mt-0.5 shrink-0 ${config.className}`} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{roadmapItem.id}</span>
                                <p className={`text-sm font-medium ${roadmapItem.status === "done" ? "text-foreground" : ""}`}>{roadmapItem.title}</p>
                              </div>
                              <p className="mt-1 text-xs leading-5 text-muted-foreground">{roadmapItem.description}</p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground/70"><span className="font-medium text-muted-foreground">Resumo:</span> {roadmapItem.summary}</p>
                            </div>
                            <Badge variant="outline" className={`text-[10px] ${priorityClass[roadmapItem.priority]}`}><Flag size={11} className="mr-1" />{roadmapItem.priority}</Badge>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </TabsContent>

          <TabsContent className="space-y-4" value="new">
            <div className="max-w-3xl">
              <p className="text-sm font-medium">Fila de Atenção (Live)</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Exibição ativa da <strong>Central de Atenção agora (N1)</strong> configurada e integrada em tempo real.
              </p>
            </div>

            {centralAtencaoEnabled ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {/* Leads sem contato */}
                <Card className="border-border bg-card shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-32">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Sem contato</span>
                      {leadsSemContatoAge && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                          {formatRelativeTime(leadsSemContatoAge)}
                        </span>
                      )}
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{leadsSemContatoCount}</span>
                      <span className="text-xs text-muted-foreground block">leads aguardando</span>
                    </div>
                    <a href="/minha-fila" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Fila de leads &rarr;
                    </a>
                  </CardContent>
                </Card>

                {/* Leads estagnados */}
                <Card className="border-border bg-card shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-32">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Estagnados</span>
                      {leadsEstagnadosAge && (
                        <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded font-mono">
                          {formatRelativeTime(leadsEstagnadosAge)}
                        </span>
                      )}
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-bold tracking-tight text-amber-500 tabular-nums">{leadsEstagnadosCount}</span>
                      <span className="text-xs text-muted-foreground block">mais de {stagnantDays} dias</span>
                    </div>
                    <a href="/leads" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Fila geral &rarr;
                    </a>
                  </CardContent>
                </Card>

                {/* Tarefas vencidas */}
                <Card className="border-border bg-card shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-32">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Tarefas vencidas</span>
                      {tarefasVencidasAge && (
                        <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-mono">
                          {formatRelativeTime(tarefasVencidasAge)}
                        </span>
                      )}
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-bold tracking-tight text-destructive tabular-nums">{tarefasVencidasCount}</span>
                      <span className="text-xs text-muted-foreground block">atividades pendentes</span>
                    </div>
                    <a href="/tarefas" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Minhas tarefas &rarr;
                    </a>
                  </CardContent>
                </Card>

                {/* Documentos pendentes */}
                <Card className="border-border bg-card shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-32">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Docs pendentes</span>
                      {documentosPendentesAge && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">
                          {formatRelativeTime(documentosPendentesAge)}
                        </span>
                      )}
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums">{documentosPendentesCount}</span>
                      <span className="text-xs text-muted-foreground block">aguardando análise</span>
                    </div>
                    <a href="/documentos" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Análise de docs &rarr;
                    </a>
                  </CardContent>
                </Card>

                {/* Integrações com falha */}
                <Card className="border-border bg-card shadow-none">
                  <CardContent className="p-4 flex flex-col justify-between h-32">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">Erro integração</span>
                      {integracoesProblemaAge && (
                        <span className="text-[10px] text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded font-mono">
                          {formatRelativeTime(integracoesProblemaAge)}
                        </span>
                      )}
                    </div>
                    <div className="my-2">
                      <span className="text-3xl font-bold tracking-tight text-rose-500 tabular-nums">{integracoesProblemaCount}</span>
                      <span className="text-xs text-muted-foreground block">entregas webhook falhas</span>
                    </div>
                    <a href="/settings" className="text-xs font-medium text-primary hover:underline flex items-center gap-1">
                      Integrações &rarr;
                    </a>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 p-6 text-center text-sm text-muted-foreground">
                A Central de Atenção (Live) está desativada por política global do super-admin.
              </div>
            )}

            <div className="max-w-3xl pt-6 border-t border-border/50">
              <p className="text-sm font-semibold">Fila de melhorias planejadas</p>
              <p className="mt-1 text-xs text-muted-foreground">Funcionalidades escolhidas para reduzir esforço diário sem deixar o sistema pesado.</p>
            </div>
            <div className="grid gap-3">
              {newRoadmapItems.map((roadmapItem, index) => (
                <Card key={roadmapItem.id} size="sm" className="border-border bg-card shadow-none transition-colors hover:bg-muted/30">
                  <CardContent className="flex items-start gap-3 py-4">
                    {roadmapItem.status === "done" ? <CheckCircle aria-label="Implementado" className="mt-0.5 size-7 shrink-0 rounded-full bg-emerald-500/10 p-1 text-emerald-500" weight="fill" /> : <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-muted/40 font-mono text-xs font-semibold text-muted-foreground">{index + 1}</span>}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{roadmapItem.id}</span>
                        <p className="text-sm font-medium">{roadmapItem.title}</p>
                        {roadmapItem.status === "done" && <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10 border-none text-[9px] px-1 py-0 h-4">Feito</Badge>}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{roadmapItem.description}</p>
                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground/70"><span className="font-medium text-muted-foreground">Resumo:</span> {roadmapItem.summary}</p>
                    </div>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${priorityClass[roadmapItem.priority]}`}><Flag size={11} className="mr-1" />{roadmapItem.priority}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}
