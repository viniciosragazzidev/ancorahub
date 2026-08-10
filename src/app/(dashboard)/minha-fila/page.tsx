import { and, count, desc, eq, gte, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";

import { DashboardHeader } from "@/components/dashboard-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { BrokerQueueClient } from "./_components/queue-client";
import { BrokerAvailabilityButton } from "./_components/broker-availability";
import { Sparkline } from "./_components/sparkline";
import { ChatCircleText, ClipboardText, ListChecks, Target, Users, Warning, XCircle, ChartLineUp } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

const activeLeadStatuses = [
  "new",
  "distributed",
  "in_contact",
  "quote_sent",
  "negotiation",
  "documentation_pending",
  "under_analysis",
] as const;

export const dynamic = "force-dynamic";

export default async function MinhaFilaPage() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // ─── Availability Status ───
  const [membership] = await db
    .select({ availabilityStatus: schema.tenantMemberships.availabilityStatus })
    .from(schema.tenantMemberships)
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.userId, context.userId),
      ),
    )
    .limit(1);
  const availabilityStatus = membership?.availabilityStatus ?? "available";

  // ─── Leads ───
  const leads = await db
    .select({
      id: schema.leads.id,
      name: schema.leads.nome,
      phone: schema.leads.telefone,
      source: schema.leads.origem,
      status: schema.leads.status,
      createdAt: schema.leads.createdAt,
      serviceStartedAt: schema.leads.serviceStartedAt,
      assignedAt: schema.leads.assignedAt,
      stageEnteredAt: schema.leads.stageEnteredAt,
    })
    .from(schema.leads)
    .where(
      and(
        eq(schema.leads.tenantId, context.tenantId),
        eq(schema.leads.corretorId, context.userId),
        or(
          ne(schema.leads.status, "distributed"),
          isNotNull(schema.leads.firstContactAt),
          isNull(schema.leads.assignedAt),
          gte(schema.leads.assignedAt, sql`now() - (${schema.tenants.slaFirstContactMinutes}::integer * interval '1 minute')`),
        ),
      ),
    )
    .innerJoin(schema.tenants, eq(schema.leads.tenantId, schema.tenants.id))
    .orderBy(desc(schema.leads.createdAt));

  // Interactions per lead
  const interactions = leads.length
    ? await db
      .select({
        leadId: schema.leadInteractions.leadId,
        createdAt: schema.leadInteractions.createdAt,
      })
      .from(schema.leadInteractions)
      .where(inArray(schema.leadInteractions.leadId, leads.map((l) => l.id)))
      .orderBy(desc(schema.leadInteractions.createdAt))
    : [];

  const latestInteraction = new Map<string, Date>();
  for (const interaction of interactions) {
    if (!latestInteraction.has(interaction.leadId))
      latestInteraction.set(interaction.leadId, interaction.createdAt);
  }

  // Task counts per lead
  const taskCounts = leads.length
    ? await db
      .select({
        leadId: schema.leadTasks.leadId,
        taskCount: count(schema.leadTasks.id),
      })
      .from(schema.leadTasks)
      .where(
        and(
          inArray(schema.leadTasks.leadId, leads.map((l) => l.id)),
          eq(schema.leadTasks.tenantId, context.tenantId),
        ),
      )
      .groupBy(schema.leadTasks.leadId)
    : [];

  const taskCount = new Map<string, number>();
  for (const tc of taskCounts) {
    taskCount.set(tc.leadId, tc.taskCount);
  }

  // ─── Pending Tasks ───
  const pendingTasks = await db
    .select({
      id: schema.leadTasks.id,
      title: schema.leadTasks.title,
      priority: schema.leadTasks.priority,
      dueAt: schema.leadTasks.dueAt,
      leadId: schema.leadTasks.leadId,
      leadName: schema.leads.nome,
    })
    .from(schema.leadTasks)
    .innerJoin(schema.leads, eq(schema.leadTasks.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.leadTasks.tenantId, context.tenantId),
        eq(schema.leadTasks.assignedTo, context.userId),
        isNull(schema.leadTasks.completedAt),
      ),
    )
    .orderBy(schema.leadTasks.dueAt, schema.leadTasks.createdAt)
    .limit(10);

  // ─── Conversations needing attention ───
  // Leads where there's at least one incoming message but no outgoing response after it
  const recentMessageLeads = leads.length
    ? await db
      .select({
        leadId: schema.whatsappMessages.leadId,
        direction: schema.whatsappMessages.direction,
        sentAt: schema.whatsappMessages.sentAt,
      })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.tenantId, context.tenantId),
          inArray(schema.whatsappMessages.leadId, leads.map((l) => l.id)),
        ),
      )
      .orderBy(desc(schema.whatsappMessages.sentAt))
    : [];

  // Find leads with incoming message as the latest (needs response)
  const latestMsgByLead = new Map<string, { direction: string; sentAt: Date }>();
  for (const msg of recentMessageLeads) {
    if (!latestMsgByLead.has(msg.leadId!)) {
      latestMsgByLead.set(msg.leadId!, { direction: msg.direction, sentAt: msg.sentAt });
    }
  }
  const leadsNeedingResponse = leads
    .filter((l) => {
      const latest = latestMsgByLead.get(l.id);
      return latest && latest.direction === "incoming";
    })
    .map((l) => ({ id: l.id, name: l.name }));

  // ─── Goal Progress ───
  const now = new Date().toISOString();
  const activeGoals = await db
    .select({
      id: schema.goals.id,
      name: schema.goals.name,
      targetType: schema.goals.targetType,
      targetValue: schema.goals.targetValue,
      period: schema.goals.period,
      startDate: schema.goals.startDate,
      endDate: schema.goals.endDate,
      progressValue: schema.goalProgress.currentValue,
      progressPct: schema.goalProgress.percentage,
    })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
    .where(
      and(
        eq(schema.goals.tenantId, context.tenantId),
        eq(schema.goals.scope, "broker"),
        eq(schema.goals.scopeId, context.userId),
        eq(schema.goals.active, true),
        sql`${schema.goals.startDate} <= ${now}`,
        sql`${schema.goals.endDate} >= ${now}`,
      ),
    )
    .limit(3);

  // Metric calculations
  const totalLeads = leads.length;
  const urgentLeads = leads.filter(
    (l) => l.status === "new" || l.status === "distributed",
  ).length;
  const inProgress = leads.filter((l) =>
    (["in_contact", "quote_sent", "negotiation"] as const).includes(
      l.status as any,
    ),
  ).length;
  const stalledCount = leads.filter(
    (l) =>
      (activeLeadStatuses as readonly string[]).includes(l.status) &&
      l.stageEnteredAt &&
      Date.now() - l.stageEnteredAt.getTime() > 3 * 24 * 60 * 60 * 1000,
  ).length;

  const overdueTasksCount = pendingTasks.filter(
    (t) => t.dueAt && t.dueAt.getTime() < Date.now(),
  ).length;

  const enrichedLeads = leads.map((lead) => ({
    ...lead,
    lastInteractionAt: latestInteraction.get(lead.id) ?? null,
    taskCount: taskCount.get(lead.id) ?? 0,
    maskPhone: lead.phone.replace(/\D/g, "").length > 4
      ? `••••${lead.phone.replace(/\D/g, "").slice(-4)}`
      : lead.phone,
  }));

  const dailyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    date.setHours(0, 0, 0, 0);

    const dayStart = date.getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;

    const leadsCreated = leads.filter((lead) => {
      const createdAt = lead.createdAt.getTime();
      return createdAt >= dayStart && createdAt < dayEnd;
    }).length;

    const urgentCreated = leads.filter((lead) => {
      const createdAt = lead.createdAt.getTime();
      return createdAt >= dayStart && dayEnd > createdAt && (lead.status === "new" || lead.status === "distributed");
    }).length;

    const activeCreated = leads.filter((lead) => {
      const createdAt = lead.createdAt.getTime();
      return createdAt >= dayStart && createdAt < dayEnd && (["in_contact", "quote_sent", "negotiation"] as readonly string[]).includes(lead.status);
    }).length;

    const stalledCreated = leads.filter((lead) => {
      const createdAt = lead.createdAt.getTime();
      return createdAt >= dayStart && createdAt < dayEnd && (activeLeadStatuses as readonly string[]).includes(lead.status) && lead.stageEnteredAt && Date.now() - lead.stageEnteredAt.getTime() > 3 * 24 * 60 * 60 * 1000;
    }).length;

    return {
      label: new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(date),
      leads: leadsCreated,
      urgent: urgentCreated,
      active: activeCreated,
      stalled: stalledCreated,
    };
  });

  const targetTypeLabel: Record<string, string> = {
    sales_count: "Vendas",
    revenue: "Receita",
    conversion_rate: "Conversão",
    leads_contacted: "Contatos",
  };

  return (
    <>
      <DashboardHeader
        breadcrumb="Minha operação"
        title="Minha fila"
        rightSlot={
          <div className="flex items-center gap-2">
            <BrokerAvailabilityButton initialStatus={availabilityStatus} />
            {overdueTasksCount > 0 && (
              <Badge variant="destructive" className="gap-1.5 rounded-md text-xs">
                {overdueTasksCount} tarefa{overdueTasksCount > 1 ? "s" : ""} vencida{overdueTasksCount > 1 ? "s" : ""}
              </Badge>
            )}
            <Badge
              variant={urgentLeads > 0 ? "warning" : "success"}
              className="gap-1.5 rounded-md text-xs"
            >
              <span className="relative flex size-2">
                {urgentLeads > 0 && (
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent/40 opacity-75" />
                )}
                <span
                  className={`relative inline-flex size-2 rounded-full ${urgentLeads > 0 ? "bg-accent" : "bg-success"}`}
                />
              </span>
              {urgentLeads > 0
                ? `${urgentLeads} urgente${urgentLeads > 1 ? "s" : ""}`
                : "Em dia"}
            </Badge>
          </div>
        }
      />
      <main className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-5 bg-background p-4 lg:gap-6 lg:p-6">
        {/* Contexto de página legado, preservado para eventual restauração.
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-medium text-primary">OPERAÇÃO</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Minha fila</h1>
            <p className="mt-1 text-sm text-muted-foreground">Comece o dia aqui: leads, tarefas, conversas, cotações e metas em um só lugar.</p>
          </div>
        </section> */}

        {/* Metric Cards */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total na fila", value: totalLeads, color: "text-chart-1", bg: "bg-chart-1/10", icon: ListChecks, chart: dailyTrend.map((day) => day.leads), sparkColor: "var(--chart-1)", cardClassName: undefined },
            { label: "Novos / urgentes", value: urgentLeads, color: "text-warning", bg: "bg-warning/10", icon: Warning, chart: dailyTrend.map((day) => day.urgent), sparkColor: "var(--warning)", cardClassName: undefined },
            { label: "Em andamento", value: inProgress, color: "text-chart-3", bg: "bg-chart-3/10", icon: ChartLineUp, chart: dailyTrend.map((day) => day.active), sparkColor: "var(--chart-3)", cardClassName: undefined },
            { label: "Estagnados", value: stalledCount, color: "text-destructive", bg: "bg-destructive/10", icon: XCircle, chart: dailyTrend.map((day) => day.stalled), sparkColor: "var(--destructive)", cardClassName: "border-destructive/40 bg-destructive/[0.03] hover:border-destructive/60" },
          ].map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={cn(
                  "group flex flex-col justify-between rounded-2xl border border-border/70 bg-card p-5 text-left shadow-[0_1px_2px_rgb(15_23_42/0.025)] transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_10px_24px_rgb(15_23_42/0.05)] motion-reduce:transform-none motion-reduce:transition-none",
                  stat.cardClassName,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110", stat.bg, stat.color)}>
                    <Icon className="size-4" />
                  </span>
                  <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase tracking-wider">7 dias</span>
                </div>
                <div className="mt-3 space-y-1">
                  <p className={cn("text-2xl font-bold tabular-nums tracking-tight", stat.color)}>{stat.value}</p>
                  <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
                </div>
                <Sparkline id={`queue-metric-${stat.label}`} data={stat.chart.map((val, idx) => ({ label: String(idx), value: val }))} color={stat.sparkColor} className="mt-3" />
              </div>
            );
          })}
        </section>

        {/* ─── Quick Action Cards ─── */}
        <section className="grid gap-4 sm:grid-cols-3">
          {/* Tasks */}
          <Card variant="subtle" className="rounded-2xl bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <ClipboardText className="size-5 text-primary" />
                <Badge variant={overdueTasksCount > 0 ? "destructive" : "outline"} className="text-[10px]">
                  {pendingTasks.length} pendente{pendingTasks.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <CardTitle className="mt-2 text-sm">Tarefas</CardTitle>
              <CardDescription className="text-xs">Próximos passos do dia</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingTasks.slice(0, 4).map((task) => (
                <Link key={task.id} href={`/leads/${task.leadId}#tarefas`} className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                  <span className={`mt-0.5 size-1.5 shrink-0 rounded-full ${task.dueAt && task.dueAt.getTime() < Date.now() ? "bg-destructive" : task.priority === "urgent" ? "bg-accent" : "bg-muted-foreground"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium group-hover:text-primary">{task.title}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">{task.leadName}{task.dueAt ? ` · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(task.dueAt)}` : ""}</span>
                  </span>
                </Link>
              ))}
              {!pendingTasks.length && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma tarefa pendente.</p>
              )}
              <Button className="w-full" render={<Link href="/tarefas" />} size="sm" variant="ghost">
                Ver todas <ListChecks className="ml-1 size-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Conversations */}
          <Card variant="subtle" className="rounded-2xl bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <ChatCircleText className="size-5 text-primary" />
                <Badge variant={leadsNeedingResponse.length > 0 ? "warning" : "outline"} className="text-[10px]">
                  {leadsNeedingResponse.length} pendente{leadsNeedingResponse.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              <CardTitle className="mt-2 text-sm">Conversas</CardTitle>
              <CardDescription className="text-xs">Aguardam resposta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {leadsNeedingResponse.slice(0, 4).map((lead) => (
                <Link key={lead.id} href={`/conversas?leadId=${lead.id}`} className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50">
                  <span className="size-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0 flex-1 truncate text-xs font-medium group-hover:text-primary">{lead.name}</span>
                </Link>
              ))}
              {!leadsNeedingResponse.length && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">Todas as conversas em dia.</p>
              )}
              <Button className="w-full" render={<Link href="/conversas" />} size="sm" variant="ghost">
                Abrir conversas <ChatCircleText className="ml-1 size-3.5" />
              </Button>
            </CardContent>
          </Card>

          {/* Goals */}
          <Card variant="subtle" className="rounded-2xl bg-card/95">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Target className="size-5 text-primary" />
                <Badge variant="outline" className="text-[10px]">{activeGoals.length} ativa{activeGoals.length !== 1 ? "s" : ""}</Badge>
              </div>
              <CardTitle className="mt-2 text-sm">Metas</CardTitle>
              <CardDescription className="text-xs">Período vigente</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeGoals.map((goal) => {
                const pct = Number(goal.progressPct);
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{goal.name}</span>
                      <span className="tablular-nums text-muted-foreground">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground">{targetTypeLabel[goal.targetType] ?? goal.targetType}</p>
                  </div>
                );
              })}
              {!activeGoals.length && (
                <p className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhuma meta ativa no período.</p>
              )}
              <Button className="w-full" render={<Link href="/minha-meta" />} size="sm" variant="ghost">
                Ver metas <Target className="ml-1 size-3.5" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Queue */}
        <Card variant="subtle" className="rounded-2xl bg-card/95">
          <CardHeader className="pb-0">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Leads na fila</CardTitle>
                <CardDescription>
                  {totalLeads} lead{totalLeads !== 1 ? "s" : ""} atribuído
                  {totalLeads !== 1 ? "s" : ""} a você
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <BrokerQueueClient leads={enrichedLeads} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
