import Link from "next/link";

import {
  ArrowRight,
  Bell,
  CalendarCheck,
  ChatCircleText,
  Lightning,
  ListChecks,
  Plus,
  Target,
  Warning,
} from "@/components/huge-icons";
import { DashboardHeader } from "@/components/dashboard-header";
import { VoxelIllustration } from "@/components/illustrations/voxel-illustration";
import { LeadStatusBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ContextNote } from "@/components/ui/context-note";
import { Progress } from "@/components/ui/progress";
import { BrokerAvailabilityButton } from "@/app/(dashboard)/minha-fila/_components/broker-availability";
import type { BrokerWorkspaceData } from "@/features/broker-workspace/queries";
import { cn } from "@/lib/utils";
import { BrokerWorkspaceActionButtons, BrokerWorkspaceTaskCompleteButton } from "./broker-workspace-actions";

// Altura máxima (px) da lista do card "Minha fila prioritária" antes de ativar o scroll.
// Ajuste aqui o valor padrão ou passe `queueMaxHeight` no <BrokerWorkspace>.
const MINHA_FILA_MAX_HEIGHT_PX = 280;

const sourceLabels = {
  message: "Mensagem",
  task: "Tarefa",
  lead: "Lead",
  document: "Documento",
  proposal: "Cotação",
  notification: "Alerta",
} as const;

function formatDueAt(value: Date | null) {
  if (!value) return "Sem horário definido";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function isOverdue(value: Date | null) {
  return value !== null && value.getTime() < Date.now();
}

export function BrokerWorkspace({
  data,
  queueMaxHeight = MINHA_FILA_MAX_HEIGHT_PX,
}: {
  data: BrokerWorkspaceData;
  queueMaxHeight?: number;
}) {
  const firstName = data.viewer.name.split(" ")[0] || "Corretor";
  const nextAction = data.nextAction;

  return (
    <>
      <DashboardHeader
        breadcrumb="Corretor / Workspace"
        title="Minha operação"
        rightSlot={
          <>
            <BrokerAvailabilityButton initialStatus={data.viewer.availabilityStatus} />
            <Button render={<Link href="/leads" />} size="sm">
              <Plus aria-hidden="true" /> Novo lead
            </Button>
          </>
        }
      />

      <main className="operational-page mx-auto flex w-full max-w-[1200px] flex-1 flex-col gap-5 p-4 lg:gap-6 lg:p-6">
        <section aria-labelledby="workspace-greeting" className="workspace-hero relative isolate overflow-hidden rounded-2xl border border-primary/15 px-5 py-6 sm:px-7 sm:py-7">
          <div className="relative z-10 flex max-w-2xl flex-col gap-2 pr-20 sm:pr-28">
            <p className="text-sm font-medium text-primary">{data.viewer.branchName}</p>
            <h1 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl" id="workspace-greeting">Bom dia, {firstName}</h1>
            <p className="max-w-xl text-pretty text-sm leading-6 text-muted-foreground">Comece pela prioridade abaixo. O restante da operação continua organizado por contexto.</p>
          </div>
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" />
          <VoxelIllustration className="absolute right-3 top-1/2 hidden size-36 -translate-y-1/2 opacity-55 lg:block dark:opacity-45" name="ocean-anchor" />
        </section>

        {nextAction ? (
          <section aria-labelledby="next-action-title" className="-mt-2 sm:-mt-3">
            <Card className="workspace-priority bg-card" variant="overview">
              <CardContent className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant={nextAction.severity === "critical" ? "destructive" : nextAction.severity === "warning" ? "warning" : "outline"}>Próxima ação</Badge>
                    {nextAction.dueAt ? <span className="text-xs text-muted-foreground">Prazo: {formatDueAt(nextAction.dueAt)}</span> : null}
                  </div>
                  <h2 className="text-balance text-xl font-semibold tracking-tight" id="next-action-title">{readableNextAction(nextAction.title, nextAction.kind)}</h2>
                  <p className="mt-1 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground">{nextAction.description}</p>
                </div>
                <BrokerWorkspaceActionButtons nextAction={nextAction} viewer={data.viewer} />
              </CardContent>
            </Card>
          </section>
        ) : (
          <ContextNote title="Sua fila está em dia" variant="success">Não há atendimento ou tarefa prioritária neste momento.</ContextNote>
        )}

        <section aria-labelledby="today-title" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-onboarding="sla-indicator">
          <h2 className="sr-only" id="today-title">Meu dia</h2>
          <TodayLink count={data.today.awaitingResponse} href="/conversas" icon={ChatCircleText} label="Conversas aguardando" tone="warning" />
          <TodayLink count={data.today.overdueTasks} href="/tarefas?attention=overdue" icon={Warning} label="Tarefas vencidas" tone="critical" />
          <TodayLink count={data.today.returnsDue} href="/tarefas" icon={CalendarCheck} label="Retornos em 24 horas" tone="normal" />
          <TodayLink count={data.today.newLeads} href="/minha-fila" icon={Lightning} label="Novos leads" tone="warning" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          <Card variant="subtle" data-onboarding="lead-queue" className="overflow-hidden bg-card/95">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0 flex-1"><CardTitle>Minha fila prioritária</CardTitle><CardDescription>Ordenada pela próxima ação e pelos prazos operacionais.</CardDescription></div>
              <Button render={<Link href="/minha-fila" />} size="sm" variant="ghost" className="shrink-0">Ver fila <ArrowRight aria-hidden="true" /></Button>
            </CardHeader>
            <CardContent className="overflow-y-auto overscroll-contain pr-1" style={{ maxHeight: queueMaxHeight }}>
              {data.queue.length ? <div className="divide-y divide-border/60">
                {data.queue.map((lead) => <Link className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary" href={`/leads/${lead.id}`} key={lead.id}>
                  <span className={cn("size-2 shrink-0 rounded-full", lead.nextAction?.severity === "critical" ? "bg-destructive" : lead.nextAction?.severity === "warning" ? "bg-warning" : "bg-muted-foreground")} />
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{lead.name}</span><span className="block truncate text-xs text-muted-foreground">{lead.nextAction?.description ?? "Sem pendência imediata"}</span></span>
                  <LeadStatusBadge status={lead.status} />
                  <ArrowRight aria-hidden="true" className="size-4 text-muted-foreground group-hover:text-primary" />
                </Link>)}
              </div> : <EmptyWorkspaceState icon={ListChecks} message="Quando você receber leads, eles aparecerão aqui por prioridade." />}
            </CardContent>
          </Card>

          <div className="grid content-start gap-5">
            <Card variant="subtle" data-onboarding="daily-tasks" className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-3"><div className="min-w-0 flex-1"><CardTitle>Agenda</CardTitle><CardDescription>Próximos retornos e tarefas.</CardDescription></div><Button render={<Link href="/tarefas" />} size="sm" variant="ghost" className="shrink-0">Ver todas</Button></CardHeader>
              <CardContent>
                {data.agenda.length ? <div className="grid gap-2">{data.agenda.map((task) => <div className="flex items-center gap-2.5 rounded-md border border-border/60 bg-background/40 px-3 py-2.5" key={task.id}>
                  <span className={cn("size-2 shrink-0 rounded-full", isOverdue(task.dueAt) ? "bg-destructive" : task.priority === "urgent" ? "bg-warning" : "bg-primary")} />
                  <Link className="min-w-0 flex-1" href={task.href}><span className="block truncate text-sm font-medium hover:text-primary">{task.title}</span><span className={cn("block text-xs", isOverdue(task.dueAt) ? "text-destructive" : "text-muted-foreground")}>{task.leadName} · {formatDueAt(task.dueAt)}</span></Link>
                  <BrokerWorkspaceTaskCompleteButton taskId={task.id} taskTitle={task.title} viewer={data.viewer} />
                </div>)}</div> : <EmptyWorkspaceState icon={CalendarCheck} message="Nenhuma tarefa pendente. Você está em dia." />}
              </CardContent>
            </Card>

            <Card variant="subtle" className="h-full">
              <CardHeader className="flex flex-row items-start justify-between gap-3"><div className="min-w-0 flex-1"><CardTitle>Minha meta</CardTitle><CardDescription>Progresso individual do período vigente.</CardDescription></div><Button render={<Link href="/minha-meta" />} size="sm" variant="ghost" className="shrink-0">Detalhes</Button></CardHeader>
              <CardContent>{data.goal ? <div className="space-y-3"><div className="flex items-end justify-between gap-3"><div><p className="text-sm font-medium">{data.goal.name}</p><p className="text-xs text-muted-foreground">{data.goal.currentValue} de {data.goal.targetValue}</p></div><strong className="text-lg tabular-nums">{Math.round(data.goal.percentage)}%</strong></div><Progress value={Math.min(100, Math.max(0, data.goal.percentage))} /></div> : <EmptyWorkspaceState icon={Target} message="Nenhuma meta individual ativa neste período." />}</CardContent>
            </Card>
          </div>
        </section>

        <Card variant="subtle" className="bg-card/95">
          <CardHeader className="flex flex-row items-start justify-between gap-3"><div className="min-w-0 flex-1"><CardTitle>Inbox operacional</CardTitle><CardDescription>Mensagens, pendências e alertas que merecem atenção.</CardDescription></div><Button render={<Link href="/notificacoes" />} size="sm" variant="ghost" className="shrink-0 max-w-24"><Bell aria-hidden="true" /> <span className="truncate">{data.today.unreadNotifications}</span></Button></CardHeader>
          <CardContent>{data.inbox.length ? <div className="divide-y divide-border/60">{data.inbox.map((item) => <Link className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0" href={item.href} key={item.id}><Badge className="mt-0.5 shrink-0" variant={item.severity === "critical" ? "destructive" : item.severity === "warning" ? "warning" : "outline"}>{sourceLabels[item.source]}</Badge><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium group-hover:text-primary">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.description}</span></span><ArrowRight aria-hidden="true" className="mt-0.5 size-4 text-muted-foreground group-hover:text-primary" /></Link>)}</div> : <EmptyWorkspaceState icon={Bell} illustration="empty-inbox" message="Nenhum alerta novo. As atualizações aparecerão aqui." />}</CardContent>
        </Card>
      </main>
    </>
  );
}

function TodayLink({ count, href, icon: Icon, label, tone }: { count: number; href: string; icon: typeof Target; label: string; tone: "critical" | "warning" | "normal" }) {
  return <Link className="group flex min-h-24 items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3 transition-[border-color,background-color,transform] duration-[var(--duration-fast)] ease-[var(--ease-smooth-out)] hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/[0.015] motion-reduce:transform-none motion-reduce:transition-none" href={href}><span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone === "critical" ? "bg-destructive/10 text-destructive" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary")}><Icon aria-hidden="true" className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block text-2xl font-semibold tabular-nums">{count}</strong><span className="block truncate text-xs text-muted-foreground">{label}</span></span><ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-quick)] group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none" /></Link>;
}

function EmptyWorkspaceState({ icon: Icon, illustration, message }: { icon: typeof Target; illustration?: "empty-inbox"; message: string }) {
  return <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-7 text-center">{illustration ? <VoxelIllustration className="size-20" name={illustration} /> : <Icon aria-hidden="true" className="size-5 text-muted-foreground" />}<p className="max-w-sm text-sm text-muted-foreground">{message}</p></div>;
}

function readableNextAction(title: string, kind: NonNullable<BrokerWorkspaceData["nextAction"]>["kind"]) {
  if (kind === "awaiting_response") return `Responder ${title}`;
  if (kind === "task_overdue" || kind === "return_due") return title;
  if (kind === "new_lead") return `Atender ${title}`;
  return `Avançar atendimento de ${title}`;
}
