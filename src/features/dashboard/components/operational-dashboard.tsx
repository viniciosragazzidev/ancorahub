import Link from "next/link";
import {
  ArrowUpRight,
  ChartBar,
  CheckCircle,
  ShieldStar,
  TrendUp,
  Users,
  Warning,
} from "@/components/huge-icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PeriodSelect } from "@/components/period-select";
import { DashboardGrid } from "@/components/dashboard";
import { DashboardCard } from "@/components/dashboard-card";
import { cn } from "@/lib/utils";
import type { DashboardViewData } from "../service";

const statusLabel: Record<string, string> = { new: "Novo", distributed: "Distribuído", in_contact: "Em atendimento", quote_sent: "Proposta", negotiation: "Negociação", converted: "Convertido", lost: "Perdido" };
const qualificationLabel: Record<string, string> = { qualified: "Qualificado", hot: "Quente", warm: "Morno", cold: "Frio", pending: "Pendente", qualifying: "Em qualificação", disqualified: "Desqualificado" };
const qualificationTone: Record<string, "success" | "warning" | "info" | "secondary" | "destructive"> = { hot: "destructive", warm: "warning", cold: "info", qualified: "success", pending: "secondary", qualifying: "info", disqualified: "secondary" };
const fmtDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));

export function OperationalDashboard({ model, period }: { model: DashboardViewData; period: number }) {
  const maxTrend = Math.max(1, ...model.trend.map((point) => point.received));
  const totalConverted = model.trend.reduce((total, point) => total + point.converted, 0);
  const bestDay = model.trend.reduce((best, point) => (point.received > best.received ? point : best), model.trend[0] ?? { date: "", received: 0, converted: 0 });
  const attentionMetric = model.metrics.find((metric) => metric.id === "attention");
  const hasAttention = Number(attentionMetric?.value ?? 0) > 0;

  return (
    <main className="mx-auto flex min-h-full w-full max-w-[1400px] flex-col gap-6 bg-background p-(--mobile-page-padding) lg:p-8">
      <header className="flex flex-col gap-5 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span>Operação comercial</span>
            <span aria-hidden="true" className="h-3 w-px bg-border" />
            <span>Últimos {period} dias</span>
          </div>
          <h1 className="mt-1.5 text-3xl font-semibold tracking-tight text-foreground">{model.header.title}</h1>
          <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">{model.header.description}</p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className={cn("inline-block size-1.5 rounded-full", hasAttention ? "bg-warning" : "bg-success")} />
            {hasAttention
              ? `${attentionMetric?.value ?? 0} exceções aguardando decisão`
              : "Operação sem exceções ativas"}
            <span aria-hidden="true" className="text-border">•</span>
            {bestDay?.date ? `Pico de ${bestDay.received} leads em ${fmtDayLabel(bestDay.date)}` : "Sem pico no período"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button render={<Link href="/leads" />} size="sm">
            Abrir leads
            <ArrowUpRight className="size-3.5" />
          </Button>
          <Button render={<Link href="/relatorios" />} variant="outline" size="sm">
            Relatórios
            <ArrowUpRight className="size-3.5" />
          </Button>
          <PeriodSelect value={period as 7 | 14 | 30 | 90} label="Período do dashboard" />
        </div>
      </header>

      <section aria-label="Indicadores do período">
        <SectionLabel icon={<ChartBar className="size-3.5" aria-hidden="true" />} title="Resumo do período" hint={`${model.trend.length} dias no ciclo`} />
        <DashboardGrid className="grid-cols-2 sm:grid-cols-4">
          {model.metrics.map((metric) => (
            <MetricTile key={metric.id} metric={metric} />
          ))}
        </DashboardGrid>
      </section>

      <section aria-label="Volume e atenção" className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <SectionLabel icon={<TrendUp className="size-3.5" aria-hidden="true" />} title="Leads recebidos" hint={`${totalConverted} convertidos no ciclo`} />
          <DashboardGrid>
            <DashboardCard className="p-4 sm:p-5">
              <TrendChart trend={model.trend} maxTrend={maxTrend} />
            </DashboardCard>
          </DashboardGrid>
        </div>
        <div className="min-w-0">
          <SectionLabel icon={<Warning className="size-3.5" aria-hidden="true" />} title="Atenção agora" hint="Exceções do período" />
          <AttentionPanel items={model.attention} />
        </div>
      </section>

      <section aria-label="Desempenho por unidade e corretor" className="grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <SectionLabel icon={<Users className="size-3.5" aria-hidden="true" />} title="Unidades por leads recebidos" hint="Ranking do período" />
          <RankCard rows={model.units.map((row) => ({ label: row.name, value: row.received, suffix: `${row.converted} convertidos` }))} />
        </div>
        <div className="min-w-0">
          <SectionLabel icon={<ShieldStar className="size-3.5" aria-hidden="true" />} title="Top corretores" hint="Recebidos e conversão" />
          <RankCard rows={model.brokers.map((row) => ({ label: row.name, value: row.received, suffix: `${row.rate}% conversão` }))} />
        </div>
      </section>

      <section aria-label="Qualificações e atividade recente" className="grid gap-6 lg:grid-cols-3">
        <div className="min-w-0">
          <SectionLabel icon={<ChartBar className="size-3.5" aria-hidden="true" />} title="Qualificações" hint="Distribuição do período" />
          <DashboardGrid>
            <DashboardCard className="p-4">
              <ul className="space-y-2.5">
                {model.qualifications.length ? (
                  model.qualifications.map((row) => (
                    <li key={row.status} className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-foreground">{qualificationLabel[row.status] ?? row.status}</span>
                      <Badge variant={qualificationTone[row.status] ?? "secondary"} className="shrink-0 font-mono">
                        {row.count}
                      </Badge>
                    </li>
                  ))
                ) : (
                  <li className="flex min-h-24 items-center justify-center rounded-lg bg-muted/40 px-3 text-center text-sm text-muted-foreground">
                    Nenhuma qualificação no período.
                  </li>
                )}
              </ul>
            </DashboardCard>
          </DashboardGrid>
        </div>
        <div className="min-w-0">
          <SectionLabel icon={<Users className="size-3.5" aria-hidden="true" />} title="Últimos leads" hint="Entradas recentes" />
          <RecentCard href="/leads" rows={model.recentLeads.map((row) => ({ id: row.id, label: row.name, detail: `${statusLabel[row.status] ?? row.status} · ${row.branchName ?? "Sem unidade"}`, date: fmtDate(row.createdAt) }))} emptyLabel="Nenhum lead no período." />
        </div>
        <div className="min-w-0">
          <SectionLabel icon={<TrendUp className="size-3.5" aria-hidden="true" />} title="Últimas vendas" hint="Resultados recentes" />
          <RecentCard href="/vendas" rows={model.recentSales.map((row) => ({ id: row.id, label: row.leadName, detail: row.value ? row.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Venda registrada", date: fmtDate(row.saleDate) }))} emptyLabel="Nenhuma venda no período." />
        </div>
      </section>
    </main>
  );
}

function SectionLabel({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
      <span aria-hidden="true" className="translate-y-0.5 text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

function MetricTile({ metric }: { metric: DashboardViewData["metrics"][number] }) {
  const tone =
    metric.tone === "success"
      ? "text-success"
      : metric.tone === "warning"
        ? "text-warning"
        : "text-foreground";
  const dot =
    metric.tone === "success"
      ? "bg-success"
      : metric.tone === "warning"
        ? "bg-warning"
        : "bg-primary";

  return (
    <DashboardCard className="p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", dot)} />
        <p className="truncate text-xs font-medium text-muted-foreground">{metric.label}</p>
      </div>
      <p className={cn("mt-2.5 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.75rem]", tone)}>
        {metric.value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{metric.description}</p>
    </DashboardCard>
  );
}

function TrendChart({ trend, maxTrend }: { trend: DashboardViewData["trend"]; maxTrend: number }) {
  if (!trend.length) {
    return (
      <div className="flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg bg-muted/40 px-4 text-center">
        <p className="text-sm font-medium text-foreground">Sem recebimentos no período</p>
        <p className="text-xs text-muted-foreground">Os barras aparecem conforme os leads chegam.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end gap-1 sm:gap-1.5" style={{ height: "10.5rem" }}>
        {trend.map((point) => {
          const receivedHeight = Math.max(3, (point.received / maxTrend) * 100);
          const convertedHeight = point.received ? Math.max(2, (point.converted / maxTrend) * 100) : 0;
          return (
            <div key={point.date} className="group/bar flex min-w-0 flex-1 flex-col items-center justify-end self-stretch">
              <div className="relative flex w-full flex-1 items-end justify-center">
                <span className="pointer-events-none absolute -top-1 z-10 hidden rounded-md border border-border bg-popover px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-popover-foreground shadow-sm group-hover/bar:block">
                  {point.received}
                </span>
                <div
                  className="relative w-full max-w-8 overflow-hidden rounded-t-[4px] transition-[height,background-color] duration-150 ease-out group-hover/bar:bg-primary motion-reduce:transition-none"
                  style={{ height: `${receivedHeight}%` }}
                  title={`${point.received} leads em ${point.date}`}
                >
                  {convertedHeight > 0 ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 bottom-0 block rounded-b-[3px] bg-emerald-500/85 dark:bg-emerald-400/85"
                      style={{ height: `${(convertedHeight / receivedHeight) * 100}%` }}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-1 border-t border-border/70 pt-2">
        {trend.map((point) => (
          <span key={point.date} className="min-w-0 flex-1 truncate text-center text-[10px] tabular-nums text-muted-foreground">
            {point.date.slice(8)}
          </span>
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-sm bg-primary" />
          Recebidos
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-2 rounded-sm bg-emerald-500 dark:bg-emerald-400" />
          Convertidos
        </span>
        <span className="ml-auto font-mono">pico {maxTrend}</span>
      </div>
    </div>
  );
}

function AttentionPanel({ items }: { items: DashboardViewData["attention"] }) {
  if (!items.length) {
    return (
      <DashboardGrid>
        <DashboardCard className="p-5">
          <div className="flex min-h-32 flex-col items-center justify-center gap-1.5 text-center">
            <span className="flex size-9 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="size-4.5 text-success" />
            </span>
            <p className="text-sm font-medium text-foreground">Nenhuma exceção operacional</p>
            <p className="max-w-[32ch] text-xs leading-relaxed text-muted-foreground">
              SLA, distribuição e follow-ups estão dentro do esperado para o período.
            </p>
          </div>
        </DashboardCard>
      </DashboardGrid>
    );
  }

  return (
    <DashboardGrid>
      <DashboardCard className="divide-y divide-border overflow-hidden">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "group flex items-center justify-between gap-3 px-4 py-3 transition-colors",
              "hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              "motion-reduce:transition-none",
            )}
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  item.tone === "danger" ? "bg-destructive" : "bg-warning",
                )}
              />
              <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1.5">
              <Badge variant={item.tone === "danger" ? "destructive" : "warning"} className="font-mono">
                {item.count}
              </Badge>
              <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </DashboardCard>
    </DashboardGrid>
  );
}

function RankCard({ rows }: { rows: Array<{ label: string; value: number; suffix: string }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <DashboardGrid>
      <DashboardCard className="p-4">
        {rows.length ? (
          <ol className="space-y-3.5">
            {rows.slice(0, 6).map((row, index) => (
              <li key={row.label}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-2">
                    <span aria-hidden="true" className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground/70">
                      {index + 1}
                    </span>
                    <span className="truncate text-sm font-medium text-foreground">{row.label}</span>
                  </span>
                  <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">{row.value}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 pl-6">
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-[width] duration-150 motion-reduce:transition-none"
                      style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
                    />
                  </div>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{row.suffix}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="flex min-h-24 items-center justify-center rounded-lg bg-muted/40 text-center text-sm text-muted-foreground">
            Nenhum dado no período.
          </p>
        )}
      </DashboardCard>
    </DashboardGrid>
  );
}

function RecentCard({
  href,
  rows,
  emptyLabel,
}: {
  href: string;
  rows: Array<{ id: string; label: string; detail: string; date: string }>;
  emptyLabel: string;
}) {
  return (
    <DashboardGrid>
      <DashboardCard className="divide-y divide-border overflow-hidden">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{row.label}</p>
                <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
              </div>
              <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{row.date}</time>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</div>
        )}
        <Link
          href={href}
          className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none"
        >
          Ver todos
          <ArrowUpRight className="size-3.5" />
        </Link>
      </DashboardCard>
    </DashboardGrid>
  );
}

function fmtDayLabel(date: string) {
  try {
    return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${date}T12:00:00`));
  } catch {
    return date;
  }
}
