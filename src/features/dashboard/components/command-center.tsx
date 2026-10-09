"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ArrowRight,
  CalendarCheck,
  Calculator,
  ChartBar,
  ChatCircleText,
  CurrencyCircleDollar,
  MagnifyingGlass,
  Plus,
  UserPlus,
  UsersThree,
} from "@/components/huge-icons";
import { DashboardHeader } from "@/components/dashboard-header";
import { Card } from "@/components/ui/card";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";
import { Input } from "@/components/ui/input";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { queueHueToDotColor } from "@/features/lead-distribution/queue-color";
import { cn } from "@/lib/utils";
import type { CommandCenterData } from "../today";
import { AttentionGrid, RecentLeadsCard } from "./dashboard-widgets";
import { DashboardSectionTabs } from "./dashboard-section-tabs";

type Shortcut = { href: string; label: string; icon: ReactNode };

const monthKey = (now: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now).slice(0, 7);

/** Search a lead by name or phone (Enter opens the filtered list). */
function LeadSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  return (
    <form
      role="search"
      className="relative min-w-0 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        const value = query.trim();
        router.push(value ? `/leads?search=${encodeURIComponent(value)}` : "/leads");
      }}
    >
      <MagnifyingGlass aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar lead por nome ou telefone"
        aria-label="Buscar lead por nome ou telefone"
        className="h-11 pl-10 text-sm"
      />
    </form>
  );
}

/**
 * Today's four numbers. The two that ask for work carry their action, so a
 * number and its shortcut are the same click.
 */
function TodayNumbers({ today }: { today: CommandCenterData["today"] }) {
  const items = [
    { label: "Chegaram hoje", value: today.received, href: "/leads", action: "Ver leads" },
    { label: "Distribuídos hoje", value: today.distributed, href: "/leads/distribuicao", action: "Ver distribuição" },
    { label: "Aguardando corretor", value: today.waiting, href: "/leads/distribuicao", action: "Distribuir", warn: today.waiting > 0 },
    { label: "Sem 1º contato", value: today.withoutFirstContact, href: "/leads?attention=unworked", action: "Cobrar atendimento", warn: today.withoutFirstContact > 0 },
  ];
  return (
    <section aria-label="Hoje" className="grid gap-px overflow-hidden rounded-[var(--radius-card)] border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className="group flex min-w-0 flex-col gap-2 bg-card px-5 py-4 transition-colors hover:bg-ds-paper-mist focus-visible:outline-none"
        >
          <span className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {item.label}
            {item.warn ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-ds-amber-ink">Pede ação</span> : null}
          </span>
          <span className={cn("font-mono text-3xl font-medium tabular-nums tracking-tight", item.warn ? "text-ds-amber-ink" : "text-foreground")}>{item.value}</span>
          <span className="flex items-center gap-1 text-xs font-medium text-ds-electric-blue">
            {item.action}
            <ArrowRight aria-hidden="true" className="size-3 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </span>
        </Link>
      ))}
    </section>
  );
}

function Shortcuts({ items }: { items: Shortcut[] }) {
  return (
    <nav aria-label="Atalhos" className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Link
          key={item.href + item.label}
          href={item.href}
          className={cn(dsButtonVariants({ dsVariant: "outlined-action" }), "h-9 gap-2 px-3 text-[13px] [&_svg]:size-4 [&_svg]:text-ds-electric-blue")}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function QueuesToday({ queues, received }: { queues: CommandCenterData["today"]["queues"]; received: number }) {
  const max = Math.max(1, ...queues.map((queue) => queue.today));
  return (
    <Card variant="overview">
      <SectionCardHeader title="Leads de hoje por fila" description={queues.length ? `${received} chegaram hoje em ${queues.length} ${queues.length === 1 ? "fila" : "filas"}.` : "Nenhum lead chegou hoje ainda."} />
      {queues.length ? (
        <ul className="divide-y divide-border">
          {queues.map((queue) => (
            <li key={queue.id ?? "none"}>
              <Link
                href={queue.id ? `/leads?fila=${queue.id}` : "/leads?fila=__none"}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 px-5 py-3.5 transition-colors hover:bg-ds-paper-mist focus-visible:outline-none"
              >
                <span className="grid min-w-0 gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ backgroundColor: queueHueToDotColor(queue.hue) }} />
                    <span className="truncate text-sm font-medium" title={queue.name}>{queue.name}</span>
                    {queue.waiting ? <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium tabular-nums text-ds-amber-ink">{queue.waiting} aguardando</span> : null}
                  </span>
                  <span className="h-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${(queue.today / max) * 100}%`, backgroundColor: queueHueToDotColor(queue.hue) }} />
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-mono text-xl font-medium tabular-nums">{queue.today}</span>
                  <span className="block text-[11px] text-muted-foreground">hoje</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 pb-6 pt-1">
          <Link href="/leads/distribuicao" className="inline-flex items-center gap-1 text-sm font-medium text-ds-electric-blue">Ver as filas <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
        </div>
      )}
    </Card>
  );
}

function DutiesNow({ welcome }: { welcome: CommandCenterData["welcome"] }) {
  const running = welcome.runningDuties ?? [];
  const list = running.length ? running : welcome.nextDuty ? [welcome.nextDuty] : [];
  return (
    <Card variant="overview">
      <SectionCardHeader
        title={running.length ? "Plantões agora" : "Próximo plantão"}
        description={running.length ? `${welcome.pulse.brokersOnDutyNow} ${welcome.pulse.brokersOnDutyNow === 1 ? "corretor" : "corretores"} em plantão.` : "Nenhum plantão rodando agora."}
      />
      {list.length ? (
        <ul className="divide-y divide-border">
          {list.map((duty) => {
            const short = duty.brokerCount < duty.minimumBrokers;
            return (
              <li key={duty.scheduleId}>
                <Link href={`/leads/distribuicao/plantao/${duty.scheduleId}`} className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-ds-paper-mist focus-visible:outline-none">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium" title={duty.name}>{duty.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {duty.running ? "Agora" : `${duty.dutyDate.slice(8, 10)}/${duty.dutyDate.slice(5, 7)}`}, {duty.startsAt} às {duty.endsAt}
                    </span>
                  </span>
                  <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", short ? "bg-warning/15 text-ds-amber-ink" : "bg-muted text-muted-foreground")}>
                    <UsersThree aria-hidden="true" className="size-3.5" />
                    {duty.brokerCount}/{duty.minimumBrokers}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="px-5 pb-5 pt-1">
          <Link href="/leads/distribuicao?view=plantao" className="inline-flex items-center gap-1 text-sm font-medium text-ds-electric-blue">Ver plantões <ArrowRight aria-hidden="true" className="size-3.5" /></Link>
        </div>
      )}
    </Card>
  );
}

/**
 * The dashboard as the command center of the day: what is happening today
 * and the shortcuts people use the most. Period reports (funnel, trends,
 * rankings) live in Relatórios.
 */
export function CommandCenter({ data, showQualityTab = false, canManage = true }: { data: CommandCenterData; showQualityTab?: boolean; canManage?: boolean }) {
  const now = new Date(data.generatedAt);
  const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(now);
  const firstRunning = data.welcome.runningDuties?.[0] ?? null;
  const shortcuts: Shortcut[] = [
    firstRunning
      ? { href: `/leads/distribuicao/plantao/${firstRunning.scheduleId}`, label: "Plantão agora", icon: <CalendarCheck /> }
      : { href: "/leads/distribuicao?view=plantao", label: "Plantões", icon: <CalendarCheck /> },
    ...(canManage ? [{ href: `/leads/distribuicao?view=plantao&escalaMes=${monthKey(now)}`, label: "Escala do mês", icon: <CalendarCheck /> }] : []),
    { href: "/conversas", label: "Conversas", icon: <ChatCircleText /> },
    { href: "/cotacao", label: "Nova cotação", icon: <Calculator /> },
    { href: "/vendas", label: "Vendas", icon: <CurrencyCircleDollar /> },
    ...(canManage ? [{ href: "/equipe/convidar", label: "Convidar corretor", icon: <UserPlus /> }] : []),
    { href: showQualityTab ? "/dashboard?tab=quality" : "/relatorios", label: "Relatórios", icon: <ChartBar /> },
  ];

  return (
    <>
      <DashboardHeader breadcrumb={dateLabel.charAt(0).toLocaleUpperCase("pt-BR") + dateLabel.slice(1)} title={data.welcome.firstName ? `Olá, ${data.welcome.firstName}` : "Dashboard"} />
      <main className="mx-auto flex min-h-full w-full max-w-[1200px] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
        {showQualityTab ? <DashboardSectionTabs active="overview" period={30} showQuality /> : null}

        <section aria-label="Buscar e criar" className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <LeadSearch />
          <Link href="/leads?new=1" className={cn(dsButtonVariants({ dsVariant: "filled-dark" }), "h-11 shrink-0 justify-center gap-1.5 px-4 text-sm")}>
            <Plus aria-hidden="true" className="size-4" /> Novo lead
          </Link>
        </section>

        <TodayNumbers today={data.today} />
        <Shortcuts items={shortcuts} />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid min-w-0 content-start gap-6">
            <QueuesToday queues={data.today.queues} received={data.today.received} />
            <RecentLeadsCard rows={data.recentLeads} now={now} />
          </div>
          <aside className="grid min-w-0 content-start gap-6" aria-label="Plantões e pendências">
            <DutiesNow welcome={data.welcome} />
            {data.attention.length ? <AttentionGrid items={data.attention} /> : (
              <Card variant="overview" className="px-5 py-4">
                <p className="text-sm font-medium">Precisa de atenção</p>
                <p className="mt-1 text-xs text-muted-foreground">Nenhuma pendência na operação agora.</p>
              </Card>
            )}
          </aside>
        </div>
      </main>
    </>
  );
}
