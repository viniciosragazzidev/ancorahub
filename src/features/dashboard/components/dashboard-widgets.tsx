"use client";

import Link from "next/link";
import {
  ArrowRight,
  Buildings,
  CalendarCheck,
  ChartBar,
  ChatCircleText,
  CheckCircle,
  Clock,
  CurrencyCircleDollar,
  ListChecks,
  Plus,
  Redistribute,
  TrendUp,
  Users,
  UsersThree,
  Warning,
} from "@/components/huge-icons";
import { Card } from "@/components/ui/card";
import { DsBarChart } from "@/components/ui/ds-bar-chart";
import { FunnelChart } from "@/components/dashboard/funnel-chart";
import { CountUpText } from "@/components/motion/count-up";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";
import { DsEmptyState } from "@/components/ui/ds-empty-state";
import { DsStatusBadge, type DsStatusBadgeStatus } from "@/components/ui/ds-status-badge";
import { SectionCardHeader } from "@/components/ui/section-card-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DashboardViewData } from "../service";

/* Layout of the dashboard (Gravura structure) in the project's own design
   system: white cards with a 1px Ash border, lattices drawn with `gap-px` over
   the border color, Electric Blue only on icons and chart bars, one Filled
   Dark CTA per screen. */

export const LEAD_STATUS: Record<string, { label: string; tone: DsStatusBadgeStatus }> = {
  new: { label: "Novo", tone: "secondary" },
  distributed: { label: "Distribuído", tone: "secondary" },
  in_contact: { label: "Em atendimento", tone: "info" },
  quote_sent: { label: "Cotação enviada", tone: "info" },
  negotiation: { label: "Em negociação", tone: "info" },
  documentation_pending: { label: "Pend. documentos", tone: "warning" },
  under_analysis: { label: "Em análise", tone: "info" },
  converted: { label: "Convertido", tone: "success" },
  lost: { label: "Perdido", tone: "destructive" },
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function dutyDay(dutyDate: string) {
  return `${WEEKDAYS[new Date(`${dutyDate}T12:00:00Z`).getUTCDay()]} ${dutyDate.slice(8, 10)}/${dutyDate.slice(5, 7)}`;
}

/** "há 4 min", "há 2 h", "ontem 18:03" or "24/09 14:20". */
export function arrivalLabel(value: string, now = new Date()) {
  const date = new Date(value);
  const minutes = Math.max(0, Math.round((now.getTime() - date.getTime()) / 60_000));
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(date);
  const day = (instant: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(instant);
  if (minutes < 60) return { main: time, sub: minutes < 1 ? "agora" : `há ${minutes} min` };
  if (day(date) === day(now)) return { main: time, sub: `há ${Math.round(minutes / 60)} h` };
  if (day(date) === day(new Date(now.getTime() - 86_400_000))) return { main: "Ontem", sub: time };
  return { main: new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(date), sub: time };
}

/* ------------------------------------------------------------ welcome */

export function WelcomeHero({
  welcome,
  dateLabel,
  summary,
}: {
  welcome: DashboardViewData["welcome"];
  dateLabel: string;
  summary: string;
}) {
  const next = welcome.nextDuty;
  const short = next ? next.brokerCount < next.minimumBrokers : false;
  // Several plantões at once: each one, with its own link.
  const running = welcome.runningDuties ?? [];
  const { pulse } = welcome;
  return (
    <Card variant="overview" className="rounded-ds-large-cards">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-5 pb-4 pt-5 sm:px-6">
        <div className="min-w-0">
          <p className="mb-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ds-caption font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Visão da operação
            <span aria-hidden="true" className="h-px w-4 bg-border" />
            {dateLabel}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            {welcome.firstName ? `Olá, ${welcome.firstName}` : "Visão da operação"}
          </h1>
          <p className="mt-1 max-w-[60ch] text-xs text-muted-foreground">{summary}</p>
        </div>
        {running.length > 1 ? (
          <div className="flex min-w-52 flex-col gap-2 border-l border-border pl-4">
            <span className="text-ds-caption font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {running.length} plantões agora
            </span>
            {running.map((duty) => (
              <div key={duty.scheduleId} className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{duty.name} · {duty.startsAt}–{duty.endsAt}</span>
                <span className="text-xs text-muted-foreground">
                  {duty.queueName && duty.queueName !== duty.name ? `${duty.queueName} · ` : ""}
                  <span className={cn(duty.brokerCount < duty.minimumBrokers && "font-medium text-ds-amber-ink")}>
                    {duty.brokerCount === 0 ? "sem corretor" : `${duty.brokerCount} ${duty.brokerCount === 1 ? "corretor" : "corretores"}`}
                  </span>
                </span>
                <Link
                  href={`/leads/distribuicao/plantao/${duty.scheduleId}`}
                  className="group inline-flex w-fit items-center gap-1 rounded-md text-xs font-medium text-ds-electric-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Abrir plantão
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </Link>
              </div>
            ))}
          </div>
        ) : (
        <div className="flex min-w-52 flex-col gap-0.5 border-l border-border pl-4">
          <span className="text-ds-caption font-medium uppercase tracking-[0.06em] text-muted-foreground">
            {next?.running ? "Plantão agora" : "Próximo plantão"}
          </span>
          {next ? (
            <>
              <span className="text-sm font-medium text-foreground">
                {next.running ? "Hoje" : dutyDay(next.dutyDate)}, {next.startsAt}–{next.endsAt}
              </span>
              <span className="text-xs text-muted-foreground">
                {next.name}
                {next.queueName && next.queueName !== next.name ? ` · ${next.queueName}` : ""}
                {" · "}
                <span className={cn(short && "font-medium text-ds-amber-ink")}>
                  {next.brokerCount === 0 ? "sem corretor" : `${next.brokerCount} ${next.brokerCount === 1 ? "corretor" : "corretores"}`}
                </span>
              </span>
              <Link
                href={`/leads/distribuicao/plantao/${next.scheduleId}`}
                className="group mt-1 inline-flex w-fit items-center gap-1 rounded-md text-xs font-medium text-ds-electric-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {next.running ? "Abrir plantão ativo" : "Abrir plantão"}
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
              </Link>
            </>
          ) : (
            <>
              <span className="text-sm font-medium text-foreground">Nenhum plantão marcado</span>
              <span className="text-xs text-muted-foreground">Os próximos plantões aparecem aqui assim que forem criados.</span>
            </>
          )}
        </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border bg-ds-paper-mist px-5 py-2.5 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <Link href="/leads?new=1" className={cn(dsButtonVariants({ dsVariant: "filled-dark" }), "h-8 gap-1.5 px-3 py-0 text-[13px]")}>
            <Plus />
            Novo lead
          </Link>
          <Link href="/leads/distribuicao?view=plantao" className={cn(dsButtonVariants({ dsVariant: "outlined-action" }), "h-8 gap-1.5 px-3 py-0 text-[13px]")}>
            <CalendarCheck />
            Escala de plantões
          </Link>
        </div>
        <Link
          href="/leads/distribuicao"
          className="group inline-flex items-center gap-2 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            aria-hidden="true"
            className={cn("size-2 rounded-full", pulse.brokersOnDutyNow > 0 ? "bg-ds-vivid-green ring-4 ring-ds-soft-mint" : "bg-ds-silver")}
          />
          {pulse.brokersOnDutyNow > 0
            ? `Distribuição ativa · ${pulse.activeQueues} ${pulse.activeQueues === 1 ? "fila" : "filas"}, ${pulse.brokersOnDutyNow} ${pulse.brokersOnDutyNow === 1 ? "corretor" : "corretores"} de plantão`
            : `Nenhum plantão agora · ${pulse.activeQueues} ${pulse.activeQueues === 1 ? "fila ativa" : "filas ativas"}`}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
        </Link>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ numbers */

const METRIC_LINKS: Record<string, { href: string; icon: React.ReactNode }> = {
  "leads-received": { href: "/leads", icon: <ChartBar /> },
  conversion: { href: "/relatorios", icon: <TrendUp /> },
  attention: { href: "/leads/distribuicao", icon: <Warning /> },
  sales: { href: "/vendas", icon: <CurrencyCircleDollar /> },
};

export function KpiStrip({ metrics }: { metrics: DashboardViewData["metrics"] }) {
  return (
    <Card variant="overview">
      <div className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const link = METRIC_LINKS[metric.id] ?? { href: "/relatorios", icon: <ChartBar /> };
          const warn = metric.tone === "warning" || metric.tone === "danger";
          return (
            <Link
              key={metric.id}
              href={link.href}
              className="group flex min-w-0 flex-col gap-3 bg-card px-5 py-4 transition-colors hover:bg-ds-paper-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-ds-caption font-medium text-ds-steel">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-ds-buttons [&_svg]:size-3.5",
                      warn ? "bg-ds-amber-wash text-ds-amber-ink" : "bg-ds-powder-blue text-ds-electric-blue",
                    )}
                  >
                    {link.icon}
                  </span>
                  <span className="truncate text-[13px]">{metric.label}</span>
                </span>
                <ArrowRight className="size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none" />
              </span>
              <span className="font-ds-mono text-2xl font-medium tabular-nums text-foreground"><CountUpText text={metric.value} /></span>
              {metric.description ? <span className="text-xs text-muted-foreground">{metric.description}</span> : null}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ leads + attention */

function MoreLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
      <ArrowRight className="size-3.5" />
    </Link>
  );
}

export function RecentLeadsCard({ rows, now }: { rows: DashboardViewData["recentLeads"]; now: Date }) {
  return (
    <Card variant="overview" className="h-full">
      <SectionCardHeader icon={<Users />} title="Leads recentes" actions={<MoreLink href="/leads">Todos os leads</MoreLink>} />
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Chegada</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead className="hidden md:table-cell">Unidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 6).map((row) => {
              const arrival = arrivalLabel(row.createdAt, now);
              const status = LEAD_STATUS[row.status] ?? { label: row.status, tone: "secondary" as const };
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <span className="flex flex-col">
                      <span className="font-medium tabular-nums">{arrival.main}</span>
                      <span className="text-xs text-muted-foreground">{arrival.sub}</span>
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56">
                    <Link href={`/leads/${row.id}`} className="block truncate font-medium hover:underline hover:underline-offset-4">
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DsStatusBadge status={status.tone} label={status.label} />
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">{row.branchName ?? "Sem unidade"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="p-5">
          <DsEmptyState icon={<Users />} title="Nenhum lead no período" description="Os leads aparecem aqui assim que chegarem." />
        </div>
      )}
    </Card>
  );
}

export function AttentionGrid({ items }: { items: DashboardViewData["attention"] }) {
  const cells = items.slice(0, 4);
  return (
    <Card variant="overview" className="h-full">
      <SectionCardHeader icon={<Warning />} title="Precisam de atenção" actions={<MoreLink href="/leads/distribuicao">Distribuição</MoreLink>} />
      {cells.length ? (
        <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-px bg-border">
          {cells.map((item, index) => (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "group flex min-w-0 flex-col justify-between gap-4 bg-card px-5 py-4 transition-colors hover:bg-ds-paper-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                cells.length % 2 === 1 && index === cells.length - 1 && "col-span-2",
              )}
            >
              <span className="text-[13px] text-muted-foreground">{item.title}</span>
              <span className="flex flex-col gap-1">
                <span className="font-ds-mono text-2xl font-medium tabular-nums text-foreground">{item.count}</span>
                <span className={cn("truncate text-xs", item.tone === "danger" ? "text-ds-rose-ink" : "text-ds-amber-ink")}>{item.description}</span>
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 items-center p-5">
          <DsEmptyState icon={<CheckCircle />} title="Nada pendente" description="A distribuição e o acompanhamento estão em dia." />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ flow + funnel */

export function FlowCard({ trend, period }: { trend: DashboardViewData["trend"]; period: number }) {
  const received = trend.reduce((total, point) => total + point.received, 0);
  const converted = trend.reduce((total, point) => total + point.converted, 0);
  const perDay = trend.length ? received / trend.length : 0;
  return (
    <Card variant="overview" className="h-full">
      <SectionCardHeader icon={<ChartBar />} title="Fluxo de leads" description={`Recebidos e convertidos por dia, últimos ${period} dias.`} />
      <div className="px-4 pb-2 pt-4">
        {received > 0 ? (
          <DsBarChart
            data={trend}
            xKey="date"
            series={[{ key: "received", label: "Recebidos" }, { key: "converted", label: "Convertidos" }]}
            xTickFormatter={(value) => `${value.slice(8, 10)}/${value.slice(5, 7)}`}
          />
        ) : (
          <DsEmptyState icon={<ChartBar />} title="Sem movimentação no período" description="O gráfico se preenche quando os leads chegarem." />
        )}
      </div>
      <dl className="mt-auto grid grid-cols-3 gap-px border-t border-border bg-border">
        {[
          ["Recebidos", received.toLocaleString("pt-BR")],
          ["Convertidos", converted.toLocaleString("pt-BR")],
          ["Média por dia", perDay.toLocaleString("pt-BR", { maximumFractionDigits: 1 })],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1 bg-card px-5 py-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-ds-mono text-lg font-medium tabular-nums text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

export function FunnelCard({ funnel }: { funnel: DashboardViewData["funnel"] }) {
  const rows = [
    ...funnel.stages.map((row) => ({ stage: LEAD_STATUS[row.stage]?.label ?? row.stage, volume: row.reached })),
    { stage: "Perdido", volume: funnel.lost, lost: true },
  ];
  return (
    <Card variant="overview" className="h-full">
      <SectionCardHeader icon={<TrendUp />} title="Funil" description={`${funnel.received.toLocaleString("pt-BR")} leads no período.`} />
      <div className="px-4 pb-5 pt-4">
        <FunnelChart data={rows} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------ units + brokers */

export function RankingCard({
  title,
  icon,
  href,
  linkLabel,
  rows,
  rateLabel,
}: {
  title: string;
  icon: React.ReactNode;
  href: string;
  linkLabel: string;
  rows: Array<{ id: string; name: string; received: number; converted: number; rate: number }>;
  rateLabel: string;
}) {
  const best = Math.max(...rows.map((row) => row.rate), 1);
  return (
    <Card variant="overview" className="h-full">
      <SectionCardHeader icon={icon} title={title} actions={<MoreLink href={href}>{linkLabel}</MoreLink>} />
      {rows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-right">Recebidos</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Convertidos</TableHead>
              <TableHead className="text-right">{rateLabel}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 6).map((row) => (
              <TableRow key={row.id}>
                <TableCell className="max-w-48 truncate font-medium">{row.name}</TableCell>
                <TableCell className="text-right font-ds-mono tabular-nums">{row.received}</TableCell>
                <TableCell className="hidden text-right font-ds-mono tabular-nums sm:table-cell">{row.converted}</TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center justify-end gap-2">
                    <span className="hidden h-1 w-14 overflow-hidden rounded-full bg-ds-paper-mist sm:block" aria-hidden="true">
                      <span className="block h-full rounded-full bg-ds-electric-blue" style={{ width: `${(row.rate / best) * 100}%` }} />
                    </span>
                    <span className="font-ds-mono tabular-nums">{row.rate.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</span>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="p-5">
          <DsEmptyState icon={icon} title="Sem dados para comparar" description="Não há movimentação suficiente no período." />
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ shortcuts */

const SHORTCUTS = [
  { href: "/leads", label: "Leads", note: "Todos os contatos, com filtros e histórico.", icon: <Users /> },
  { href: "/leads/distribuicao", label: "Distribuição", note: "Filas, plantões e regras de roteamento.", icon: <Redistribute /> },
  { href: "/minha-fila", label: "Minha fila", note: "Os leads que chegaram para você.", icon: <Clock /> },
  { href: "/conversas", label: "Conversas", note: "WhatsApp dos corretores e da diretoria.", icon: <ChatCircleText /> },
  { href: "/vendas", label: "Vendas", note: "Contratos fechados e comissões.", icon: <CurrencyCircleDollar /> },
  { href: "/tarefas", label: "Tarefas", note: "Retornos e documentos pendentes.", icon: <ListChecks /> },
  { href: "/equipe", label: "Equipe", note: "Corretores, gestores e acessos.", icon: <UsersThree /> },
  { href: "/unidades", label: "Unidades", note: "Equipes, endereços e metas.", icon: <Buildings /> },
] as const;

export function ShortcutGrid() {
  return (
    <Card variant="overview">
      <SectionCardHeader title="Operação" description="Cada área do CRM, a um clique." />
      <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
        {SHORTCUTS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex min-w-0 flex-col gap-3 bg-card px-5 py-4 transition-colors hover:bg-ds-paper-mist focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <span className="flex items-center justify-between text-ds-electric-blue [&_svg]:size-5">
              {item.icon}
              <ArrowRight className="size-3.5! -translate-x-1 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0 group-hover:opacity-100 motion-reduce:transition-none" />
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-[13px] leading-5 text-muted-foreground">{item.note}</span>
            </span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
