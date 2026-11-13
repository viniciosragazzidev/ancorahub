"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { StatCard } from "@/components/dashboard/metric-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DsBarChart } from "@/components/ui/ds-bar-chart";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";
import { LiteRouteTabs } from "@/components/lite/page/route-tabs";
import page from "@/components/lite/page/lite-page.module.css";
import {
  ErpList, ErpMonthFilter, ErpNote, ErpPanel, ErpSection, ErpSettingsMenu, ErpToolbar, ErpUrlFilter, type ErpColumn, type ErpMenuItem,
} from "../ui/erp-kit";
import { useErpSkin } from "../ui/skin-context";
import { formatBasisPoints, formatDateTime, monthLabel } from "../analytics-core";
import { formatCents } from "../contracts";
import type { getCarrierReport, getDailyReport, getGrowthReport, getProductionReport, getScopedGoals, MetricDefinition } from "../analytics";

type Production = Awaited<ReturnType<typeof getProductionReport>>;
type Carriers = Awaited<ReturnType<typeof getCarrierReport>>;
type Growth = Awaited<ReturnType<typeof getGrowthReport>>;
type Daily = Awaited<ReturnType<typeof getDailyReport>>;
type Goals = Awaited<ReturnType<typeof getScopedGoals>>;
type Unit = { id: string; name: string };

const NO_VALUES = "Sem acesso a valores";
const ALL_UNITS = "all";
const number = (value: number | null) => (value === null ? "—" : value.toLocaleString("pt-BR"));
const money = (value: number | null) => (value === null ? "—" : formatCents(value));
const dayLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const weekday = (day: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
  .format(new Date(`${day}T12:00:00Z`))
  .replace(".", "");

const PERSPECTIVES = [
  { id: "producao", href: "/relatorios/producao", label: "Produção" },
  { id: "operadoras", href: "/relatorios/operadoras", label: "Operadoras" },
  { id: "crescimento", href: "/relatorios/crescimento", label: "Crescimento" },
  { id: "diario", href: "/relatorios/diario", label: "Análise diária" },
] as const;
export type AnalyticsPerspective = (typeof PERSPECTIVES)[number]["id"];

/** Perspective navigation with the system route tabs of each skin. */
export function AnalyticsTabs({ current }: { current: AnalyticsPerspective }) {
  const skin = useErpSkin();
  const tabs = PERSPECTIVES.map((item) => ({ id: item.id, label: item.label, href: item.href }));
  if (skin === "lite") return <LiteRouteTabs label="Perspectivas de inteligência" tabs={tabs} active={current} />;
  return <RouteSectionTabs label="Perspectivas de inteligência" tabs={tabs} active={current} />;
}

/** KPI row: StatCards in the grid of each skin. */
function KpiRow({ label, children }: { label: string; children: ReactNode }) {
  const skin = useErpSkin();
  const className = skin === "lite" ? page.stats : "grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4";
  return <section className={className} aria-label={label}>{children}</section>;
}

/**
 * "Configurações ▾" of an analytics screen: the calculation memory opens in the drawer; drill-down links go to the menu.
 * Rendered in the page header (inside ErpPage, so it follows the viewer's skin).
 */
export function AnalyticsSettings({ metrics, generatedAt, links = [] }: {
  metrics: readonly MetricDefinition[]; generatedAt: string; links?: { id: string; label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);
  const items: ErpMenuItem[] = [];
  if (metrics.length) items.push({ id: "memoria", label: "Memória de cálculo", onSelect: () => setOpen(true) });
  for (const link of links) items.push({ id: link.id, label: link.label, href: link.href });
  const description = `Dados de ${formatDateTime(generatedAt)}, horário de Brasília.`;
  return <>
    <ErpSettingsMenu items={items} />
    <ErpPanel open={open} onOpenChange={setOpen} title="Memória de cálculo" description={description}>
      <dl className="flex flex-col gap-3 text-sm">
        {metrics.map((metric) => <div key={metric.id} className="flex flex-col gap-1">
          <dt className="font-medium text-foreground">
            {metric.label}{" "}
            <span className="font-normal text-muted-foreground">· {metric.id} v{metric.version} · {metric.unit === "cents" ? "R$" : "contagem"}</span>
          </dt>
          <dd className="text-muted-foreground">{metric.description} Fonte: {metric.fact}. Data considerada: {metric.dateBasis}.</dd>
        </div>)}
      </dl>
    </ErpPanel>
  </>;
}

function UnitFilter({ units, unit }: { units: Unit[]; unit: string }) {
  if (!units.length) return null;
  const options = [{ value: ALL_UNITS, label: "Todas as unidades do seu escopo" }, ...units.map((item) => ({ value: item.id, label: item.name }))];
  return <ErpUrlFilter label="Unidade" param="unit" value={unit || ALL_UNITS} options={options} defaultValue={ALL_UNITS} />;
}

function PeriodToolbar({ from, to, unit, units }: { from: string; to: string; unit: string; units: Unit[] }) {
  return <ErpToolbar>
    <ErpMonthFilter label="Mês inicial" param="from" value={from} />
    <ErpMonthFilter label="Mês final" param="to" value={to} />
    <UnitFilter units={units} unit={unit} />
  </ErpToolbar>;
}

function FreshnessNote({ generatedAt }: { generatedAt: string }) {
  return <ErpNote>
    Atualizado em {formatDateTime(generatedAt)} (consulta direta, horário de Brasília). A memória de cálculo fica em Configurações.
  </ErpNote>;
}

function MonthCell({ month, partial }: { month: string; partial: boolean }) {
  return <span>{monthLabel(month)}{partial ? <> <Badge variant="outline">parcial</Badge></> : null}</span>;
}

type ProductionRow = Production["rows"][number];

export function ProductionView({ report }: { report: Production }) {
  const { visibility, totals } = report;
  const hasData = report.rows.some((row) => row.count || row.cancelled || row.implanted || row.cash);
  const columns: ErpColumn<ProductionRow>[] = [
    { id: "month", label: "Mês", primary: true, render: (row) => <MonthCell month={row.month} partial={row.partial} /> },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "cancelled", label: "Canceladas", numeric: true, render: (row) => number(row.cancelled) },
    ...(visibility.values ? [{ id: "cents", label: "Valor vendido", numeric: true, render: (row: ProductionRow) => money(row.cents) }] : []),
    { id: "implanted", label: "Implantações", numeric: true, render: (row) => number(row.implanted) },
    ...(visibility.cash ? [{ id: "cash", label: "Recebido", numeric: true, render: (row: ProductionRow) => money(row.cash) }] : []),
  ];
  const chart = report.rows.map((row) => ({ month: row.month, vendas: row.count, implantacoes: row.implanted }));
  return <>
    <AnalyticsTabs current="producao" />
    <ErpNote>
      Produção, implantação e recebimento são fatos separados: venda não comprova implantação, e implantação não comprova recebimento.
    </ErpNote>
    <PeriodToolbar from={report.from} to={report.to} unit={report.unit} units={report.units} />
    <KpiRow label="Totais do período">
      <StatCard label="Vendas" value={number(totals.count)} sublabel={`${number(totals.cancelled)} cancelada(s) fora do total`} />
      <StatCard label="Valor vendido" value={visibility.values ? money(totals.cents) : NO_VALUES} />
      <StatCard label="Implantações" value={number(totals.implanted)} />
      <StatCard label="Recebido pela corretora" value={visibility.cash ? money(totals.cash) : NO_VALUES} />
    </KpiRow>
    {hasData ? <ErpSection title="Vendas por mês">
      <DsBarChart data={chart} xKey="month" xTickFormatter={monthLabel}
        series={[{ key: "vendas", label: "Vendas" }, { key: "implantacoes", label: "Implantações" }]} />
    </ErpSection> : null}
    <ErpList title="Produção por mês" columns={columns} rows={hasData ? report.rows : []} rowKey={(row) => row.month}
      emptyTitle="Sem produção no período" emptyText="Nenhuma venda, implantação ou recebimento confirmado neste período e escopo." />
    {!visibility.values || !visibility.cash ? <ErpNote>Valores aparecem apenas para quem tem acesso a eles no seu escopo.</ErpNote> : null}
    <FreshnessNote generatedAt={report.generatedAt} />
  </>;
}

type CarrierRow = Carriers["rows"][number];

export function CarrierView({ report }: { report: Carriers }) {
  const { visibility, totals } = report;
  const columns: ErpColumn<CarrierRow>[] = [
    { id: "name", label: "Operadora", primary: true, render: (row) => (row.carrierId ? row.name : <span className="text-muted-foreground">{row.name}</span>) },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "share", label: "Participação", numeric: true, render: (row) => formatBasisPoints(row.share) },
    ...(visibility.values ? [
      { id: "cents", label: "Valor vendido", numeric: true, render: (row: CarrierRow) => money(row.cents) },
      { id: "valueShare", label: "Part. no valor", numeric: true, render: (row: CarrierRow) => formatBasisPoints(row.valueShare) },
    ] : []),
    { id: "cancelled", label: "Canceladas", numeric: true, render: (row) => number(row.cancelled) },
  ];
  return <>
    <AnalyticsTabs current="operadoras" />
    <ErpNote>Vendas por operadora do plano vendido, com participação no total do período.</ErpNote>
    <PeriodToolbar from={report.from} to={report.to} unit={report.unit} units={report.units} />
    <KpiRow label="Totais do período">
      <StatCard label="Vendas" value={number(totals.count)} sublabel={`${number(totals.cancelled)} cancelada(s) fora do total`} />
      <StatCard label="Operadoras" value={number(report.rows.filter((row) => row.count > 0).length)} />
      <StatCard label="Valor vendido" value={visibility.values ? money(totals.cents) : NO_VALUES} />
    </KpiRow>
    <ErpList title="Vendas por operadora" columns={columns} rows={report.rows} rowKey={(row) => row.carrierId ?? "none"}
      emptyTitle="Sem vendas no período" emptyText="Nenhuma venda registrada neste período e escopo." />
    <ErpNote>“Não informada” reúne vendas sem plano de operadora vinculado. A participação usa só vendas ativas.</ErpNote>
    <FreshnessNote generatedAt={report.generatedAt} />
  </>;
}

type GrowthRow = Growth["rows"][number];

export function GrowthView({ report }: { report: Growth }) {
  const { visibility, totals } = report;
  const hasData = report.rows.some((row) => row.count || row.previousCount);
  const columns: ErpColumn<GrowthRow>[] = [
    { id: "month", label: "Mês", primary: true, render: (row) => <MonthCell month={row.month} partial={row.partial} /> },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "previousCount", label: "Ano anterior", numeric: true, render: (row) => number(row.previousCount) },
    { id: "countYoy", label: "Variação", numeric: true, render: (row) => formatBasisPoints(row.countYoy, true) },
    ...(visibility.values ? [
      { id: "cents", label: "Valor vendido", numeric: true, render: (row: GrowthRow) => money(row.cents) },
      { id: "previousCents", label: "Valor ano anterior", numeric: true, render: (row: GrowthRow) => money(row.previousCents) },
      { id: "centsYoy", label: "Variação do valor", numeric: true, render: (row: GrowthRow) => formatBasisPoints(row.centsYoy, true) },
    ] : []),
  ];
  const chart = report.rows.map((row) => ({ month: row.month, atual: row.count, anterior: row.previousCount ?? 0 }));
  return <>
    <AnalyticsTabs current="crescimento" />
    <ErpNote>Últimos 12 meses comparados ao mesmo mês do ano anterior.</ErpNote>
    {report.units.length ? <ErpToolbar><UnitFilter units={report.units} unit={report.unit} /></ErpToolbar> : null}
    <KpiRow label="Totais dos últimos 12 meses">
      <StatCard label="Vendas em 12 meses" value={number(totals.count)} sublabel={`Ano anterior: ${number(totals.previousCount)}`} />
      <StatCard label="Variação das vendas" value={formatBasisPoints(totals.countYoy, true)} />
      <StatCard label="Valor vendido em 12 meses" value={visibility.values ? money(totals.cents) : NO_VALUES} />
      <StatCard label="Variação do valor" value={visibility.values ? formatBasisPoints(totals.centsYoy, true) : NO_VALUES} />
    </KpiRow>
    {hasData ? <ErpSection title="Vendas: mês atual e mesmo mês do ano anterior">
      <DsBarChart data={chart} xKey="month" xTickFormatter={monthLabel}
        series={[{ key: "atual", label: "Período" }, { key: "anterior", label: "Ano anterior" }]} />
    </ErpSection> : null}
    <ErpList title="Crescimento por mês" columns={columns} rows={hasData ? report.rows : []} rowKey={(row) => row.month}
      emptyTitle="Sem histórico" emptyText="Nenhuma venda nos últimos 24 meses neste escopo." />
    <ErpNote>
      “—” na variação: sem base no ano anterior (zero ou sem registro). Mês parcial compara dias incompletos com o mês fechado do ano anterior.
    </ErpNote>
    <FreshnessNote generatedAt={report.generatedAt} />
  </>;
}

type DailyRow = Daily["rows"][number];

export function DailyView({ report }: { report: Daily }) {
  const { totals } = report;
  const hasData = Boolean(totals.count || totals.leads || totals.cancelled);
  const columns: ErpColumn<DailyRow>[] = [
    {
      id: "day", label: "Dia", primary: true,
      render: (row) => <span>{dayLabel(row.day)} <span className="text-muted-foreground">{weekday(row.day)}</span></span>,
    },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "cancelled", label: "Canceladas", numeric: true, render: (row) => number(row.cancelled) },
    { id: "leads", label: "Leads recebidos", numeric: true, render: (row) => number(row.leads) },
  ];
  const chart = report.rows.filter((row) => !row.future).map((row) => ({ day: row.day, vendas: row.count ?? 0, leads: row.leads ?? 0 }));
  return <>
    <AnalyticsTabs current="diario" />
    <ErpNote>Dia a dia do mês: vendas pela data da venda e leads pela data de entrada.</ErpNote>
    <ErpToolbar>
      <ErpMonthFilter label="Mês" param="month" value={report.month} />
      <UnitFilter units={report.units} unit={report.unit} />
    </ErpToolbar>
    <KpiRow label="Totais do mês">
      <StatCard label="Vendas no mês" value={number(totals.count)} sublabel={report.partial ? "Mês em andamento" : undefined} />
      <StatCard label="Leads recebidos" value={number(totals.leads)} />
      <StatCard label="Canceladas" value={number(totals.cancelled)} />
    </KpiRow>
    {hasData ? <ErpSection title="Vendas e leads por dia">
      <DsBarChart data={chart} xKey="day" xTickFormatter={dayLabel}
        series={[{ key: "vendas", label: "Vendas (data da venda)" }, { key: "leads", label: "Leads (data de entrada)" }]} />
    </ErpSection> : null}
    <ErpList title="Movimento por dia" columns={columns} rows={hasData ? report.rows : []} rowKey={(row) => row.day}
      emptyTitle="Sem movimento no mês" emptyText="Nenhuma venda ou lead recebido neste mês e escopo." />
    <ErpNote>
      Cada dia mostra o que aconteceu nele: a venda pela data da venda e o lead pela data de entrada.
      Não há média nem divisão por 30; dias futuros aparecem como “—”.
    </ErpNote>
    <FreshnessNote generatedAt={report.generatedAt} />
  </>;
}

type GoalRow = Goals["rows"][number];

const goalValue = (value: GoalRow["target"], hidden: boolean) => {
  if (hidden) return NO_VALUES;
  if (!value) return "—";
  if (value.kind === "cents") return money(value.value);
  const numeric = Number(value.value);
  const text = Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : value.value;
  if (value.kind === "percent") return `${text}%`;
  return value.kind === "minutes" ? `${text} min` : text;
};
const goalPercentage = (row: GoalRow) => {
  if (row.hideMoney || row.percentage === null) return "—";
  return `${Number(row.percentage).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
};
const shortDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));
const goalProgressNote = (row: GoalRow) => (row.calculatedAt ? `Calculado em ${formatDateTime(row.calculatedAt)}` : "Progresso ainda não calculado");

export function GoalsView({ goals }: { goals: Goals }) {
  const reached = goals.rows.filter((row) => !row.hideMoney && row.percentage !== null && Number(row.percentage) >= 100).length;
  const columns: ErpColumn<GoalRow>[] = [
    { id: "name", label: "Meta", primary: true, render: (row) => row.name },
    { id: "progress", label: "Progresso", secondary: true, render: goalProgressNote },
    { id: "scope", label: "Abrangência", render: (row) => (row.owner ? `${row.scopeLabel} · ${row.owner}` : row.scopeLabel) },
    { id: "period", label: "Período", nowrap: true, render: (row) => `${shortDate(row.startDate)} a ${shortDate(row.endDate)}` },
    { id: "target", label: "Alvo", numeric: true, render: (row) => goalValue(row.target, row.hideMoney) },
    { id: "current", label: "Atual", numeric: true, render: (row) => goalValue(row.current, row.hideMoney) },
    { id: "percentage", label: "Atingido", numeric: true, render: goalPercentage },
    { id: "status", label: "Situação", render: (row) => <Badge variant={row.status === "Vigente" ? "default" : "outline"}>{row.status}</Badge> },
  ];
  const where = goals.manageHref ? "As metas são definidas em Gestão (atalho em Configurações)." : "As metas são definidas pela direção.";
  return <>
    <ErpNote>Consulta somente leitura. {where}</ErpNote>
    <KpiRow label="Resumo das metas">
      <StatCard label="Metas no seu escopo" value={number(goals.rows.length)} />
      <StatCard label="Vigentes" value={number(goals.rows.filter((row) => row.status === "Vigente").length)} />
      <StatCard label="Atingidas" value={number(reached)} sublabel="Pelo último progresso calculado" />
      <StatCard label="Sem progresso calculado" value={number(goals.rows.filter((row) => !row.calculatedAt).length)} />
    </KpiRow>
    <ErpList title="Metas" columns={columns} rows={goals.rows} rowKey={(row) => row.id}
      emptyTitle="Nenhuma meta no seu escopo" emptyText="Quando a direção definir metas para você, sua equipe ou unidade, elas aparecem aqui." />
    <ErpNote>Atualizado em {formatDateTime(goals.generatedAt)}. Fonte: metas ativas e o último progresso calculado pelo módulo de metas.</ErpNote>
  </>;
}

export function AnalyticsError({ title, reset, clearHref }: { title: string; reset: () => void; clearHref: string }) {
  return <main className={page.stack}>
    <section className={page.empty} role="alert">
      <h2 className={page.emptyTitle}>{title}</h2>
      <p className={page.emptyText}>
        Confira se o módulo está liberado para seu perfil e se o período e a unidade são válidos. Se estava funcionando, tente novamente.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Button type="button" onClick={reset}>Tentar novamente</Button>
        <Button variant="outline" render={<Link href={clearHref} />}>Limpar filtros</Button>
        <Button variant="outline" render={<Link href="/dashboard" />}>Voltar ao início</Button>
      </div>
    </section>
  </main>;
}
