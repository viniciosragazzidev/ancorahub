"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { StatCard } from "@/components/dashboard/metric-card";
import { Button } from "@/components/ui/button";
import { DsBarChart } from "@/components/ui/ds-bar-chart";
import { DsSegmentedControl } from "@/components/ui/ds-segmented-control";
import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import page from "@/components/lite/page/lite-page.module.css";
import {
  ErpCell, ErpList, ErpMonthFilter, ErpPanel, ErpSection, ErpSettingsMenu, ErpStats, ErpStatus, ErpToolbar, ErpUrlFilter,
  type ErpColumn, type ErpMenuItem, type ErpTone,
} from "../ui/erp-kit";
import { useErpSkin } from "../ui/skin-context";
import { formatCompetence, formatDay, formatInstant, plural } from "../ui/format";
import { formatBasisPoints } from "../analytics-core";
import { formatCents } from "../contracts";
import type { getCarrierReport, getDailyReport, getGrowthReport, getProductionReport, getScopedGoals, MetricDefinition } from "../analytics";
import styles from "./analytics-views.module.css";

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
const monthTick = (month: string) => formatCompetence(month);
const axisNumber = (value: number) => value.toLocaleString("pt-BR");
const weekday = (day: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" })
  .format(new Date(`${day}T12:00:00Z`))
  .replace(".", "");

// ─── Perspectives (segmented, in the toolbar) ───────────────────────────────

const PERSPECTIVES = [
  { id: "producao", href: "/relatorios/producao", label: "Produção" },
  { id: "operadoras", href: "/relatorios/operadoras", label: "Operadoras" },
  { id: "crescimento", href: "/relatorios/crescimento", label: "Crescimento" },
  { id: "diario", href: "/relatorios/diario", label: "Análise diária" },
] as const;
export type AnalyticsPerspective = (typeof PERSPECTIVES)[number]["id"];

/**
 * The four perspectives of Inteligência as one compact segmented control in the filter bar. The area tab
 * ("Inteligência") is the route level; this control only switches the report, keeping the unit filter.
 */
export function AnalyticsTabs({ current }: { current: AnalyticsPerspective }) {
  const skin = useErpSkin(); const router = useRouter();
  const go = (value: string) => {
    const target = PERSPECTIVES.find((item) => item.id === value);
    if (target && value !== current) router.push(target.href, { scroll: false });
  };
  const prefetch = (value: string) => { const target = PERSPECTIVES.find((item) => item.id === value); if (target) router.prefetch(target.href); };
  const options = PERSPECTIVES.map((item) => ({ value: item.id, label: item.label }));
  if (skin === "lite") return <SegmentedControl className={styles.perspectives} label="Perspectivas de inteligência" options={options} value={current} onValueChange={go} onOptionIntent={prefetch} />;
  return <DsSegmentedControl aria-label="Perspectivas de inteligência" className={styles.perspectives} options={options} value={current} onValueChange={go} />;
}

// ─── Header: one neutral menu with the rules, the calculation memory and the drill-downs ──

const HELP: Record<AnalyticsPerspective | "metas", ReactNode> = {
  producao: <>
    <p>Produção, implantação e recebimento são fatos separados: venda não comprova implantação, e implantação não comprova recebimento.</p>
    <p>Vendas contam pela data da venda; canceladas ficam fora do total. Valores aparecem só para quem tem acesso a eles no seu escopo.</p>
  </>,
  operadoras: <>
    <p>Vendas por operadora do plano vendido, com a participação de cada uma no total do período.</p>
    <p>&quot;Não informada&quot; reúne vendas sem plano de operadora vinculado. A participação usa só vendas ativas.</p>
  </>,
  crescimento: <>
    <p>Os últimos 12 meses comparados ao mesmo mês do ano anterior.</p>
    <p>&quot;—&quot; na variação significa que não há base no ano anterior. O mês em andamento compara dias incompletos com o mês fechado do ano anterior.</p>
  </>,
  diario: <>
    <p>Cada dia mostra o que aconteceu nele: a venda pela data da venda e o lead pela data de entrada.</p>
    <p>Não há média nem divisão por 30. Dias que ainda não chegaram aparecem como &quot;—&quot;.</p>
  </>,
  metas: <>
    <p>Consulta somente leitura das metas ativas no seu escopo, com o último progresso calculado pelo módulo de metas.</p>
    <p>As metas são definidas pela direção, em Gestão.</p>
  </>,
};

/**
 * "Opções ▾" of an analytics screen: how the screen works, the calculation memory and drill-down links, each in the
 * drawer or as a link. Rendered in the page header (inside ErpPage, so it follows the viewer's skin).
 */
export function AnalyticsSettings({ metrics, generatedAt, links = [], perspective }: {
  metrics: readonly MetricDefinition[]; generatedAt: string; links?: { id: string; label: string; href: string }[]; perspective?: AnalyticsPerspective | "metas";
}) {
  const [open, setOpen] = useState<"memory" | "help" | null>(null);
  const items: ErpMenuItem[] = [];
  if (perspective) items.push({ id: "como-funciona", label: "Como funciona", onSelect: () => setOpen("help") });
  if (metrics.length) items.push({ id: "memoria", label: "Memória de cálculo", onSelect: () => setOpen("memory") });
  for (const link of links) items.push({ id: link.id, label: link.label, href: link.href });
  const description = `Dados de ${formatInstant(generatedAt)}, horário de Brasília.`;
  return <>
    <ErpSettingsMenu label="Opções" items={items} />
    <ErpPanel open={open === "memory"} onOpenChange={(next) => setOpen(next ? "memory" : null)} title="Memória de cálculo" description={description}>
      <dl className={styles.memory}>
        {metrics.map((metric) => <div key={metric.id}>
          <dt>{metric.label} <span className="font-normal text-muted-foreground">· {metric.id} v{metric.version} · {metric.unit === "cents" ? "R$" : "contagem"}</span></dt>
          <dd>{metric.description} Fonte: {metric.fact}. Data considerada: {metric.dateBasis}.</dd>
        </div>)}
      </dl>
    </ErpPanel>
    {perspective ? <ErpPanel open={open === "help"} onOpenChange={(next) => setOpen(next ? "help" : null)} title="Como funciona" description={description}>
      <div className={styles.help}>{HELP[perspective]}</div>
    </ErpPanel> : null}
  </>;
}

// ─── Filter bar pieces ──────────────────────────────────────────────────────

function UnitFilter({ units, unit }: { units: Unit[]; unit: string }) {
  if (!units.length) return null;
  const options = [{ value: ALL_UNITS, label: "Todas as unidades" }, ...units.map((item) => ({ value: item.id, label: item.name }))];
  return <ErpUrlFilter label="Unidade" param="unit" value={unit || ALL_UNITS} options={options} defaultValue={ALL_UNITS} />;
}

/** "Dados de 13/11/2026, 14:32" at the end of the filter bar (the query runs live, no cache). */
function Freshness({ generatedAt }: { generatedAt: string }) {
  return <span className={styles.fresh}>Dados de {formatInstant(generatedAt)}</span>;
}

function PeriodToolbar({ current, from, to, unit, units, generatedAt }: { current: AnalyticsPerspective; from: string; to: string; unit: string; units: Unit[]; generatedAt: string }) {
  return <ErpToolbar>
    <AnalyticsTabs current={current} />
    <ErpMonthFilter label="Mês inicial" param="from" value={from} allLabel={null} />
    <ErpMonthFilter label="Mês final" param="to" value={to} allLabel={null} />
    <UnitFilter units={units} unit={unit} />
    <Freshness generatedAt={generatedAt} />
  </ErpToolbar>;
}

function MonthCell({ month, partial }: { month: string; partial: boolean }) {
  const label = formatCompetence(month, "long").replace(/^./, (letter) => letter.toUpperCase());
  return <ErpCell title={label} sub={partial ? "Mês em andamento" : undefined} />;
}

/** Share as a number with a small bar (same hue, never a second color). */
function Share({ basisPoints }: { basisPoints: number | null }) {
  const width = basisPoints === null ? 0 : Math.max(0, Math.min(100, basisPoints / 100));
  return <span className={styles.share}><span className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${width}%` }} /></span>{formatBasisPoints(basisPoints)}</span>;
}

// ─── Produção ───────────────────────────────────────────────────────────────

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
    <ErpStats>
      <StatCard label="Vendas" value={number(totals.count)} sublabel={`${number(totals.cancelled)} cancelada(s) fora do total`} />
      <StatCard label="Valor vendido" value={visibility.values ? money(totals.cents) : NO_VALUES} sublabel="vendas ativas no período" />
      <StatCard label="Implantações" value={number(totals.implanted)} sublabel="cobertura confirmada" />
      <StatCard label="Recebido pela corretora" value={visibility.cash ? money(totals.cash) : NO_VALUES} sublabel="liquidações confirmadas" />
    </ErpStats>
    <PeriodToolbar current="producao" from={report.from} to={report.to} unit={report.unit} units={report.units} generatedAt={report.generatedAt} />
    {hasData ? <ErpSection title="Vendas e implantações por mês">
      <DsBarChart data={chart} xKey="month" xTickFormatter={monthTick} yAxisWidth={40} yTickFormatter={axisNumber}
        series={[{ key: "vendas", label: "Vendas" }, { key: "implantacoes", label: "Implantações" }]} />
    </ErpSection> : null}
    <ErpList title="Produção por mês" columns={columns} rows={hasData ? report.rows : []} rowKey={(row) => row.month}
      count={report.rows.length} countLabel={["mês", "meses"]}
      emptyTitle="Sem produção no período" emptyText="Nenhuma venda, implantação ou recebimento confirmado neste período e escopo." />
  </>;
}

// ─── Operadoras ─────────────────────────────────────────────────────────────

type CarrierRow = Carriers["rows"][number];

export function CarrierView({ report }: { report: Carriers }) {
  const { visibility, totals } = report;
  const active = report.rows.filter((row) => row.count > 0);
  const leader = active[0] ?? null;
  const columns: ErpColumn<CarrierRow>[] = [
    { id: "name", label: "Operadora", primary: true, render: (row) => <ErpCell title={row.name} sub={row.carrierId ? undefined : "Sem plano vinculado"} /> },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "share", label: "Participação", numeric: true, render: (row) => <Share basisPoints={row.share} /> },
    ...(visibility.values ? [
      { id: "cents", label: "Valor vendido", numeric: true, render: (row: CarrierRow) => money(row.cents) },
      { id: "valueShare", label: "Part. no valor", numeric: true, render: (row: CarrierRow) => formatBasisPoints(row.valueShare) },
    ] : []),
    { id: "cancelled", label: "Canceladas", numeric: true, render: (row) => number(row.cancelled) },
  ];
  return <>
    <ErpStats>
      <StatCard label="Vendas" value={number(totals.count)} sublabel={`${number(totals.cancelled)} cancelada(s) fora do total`} />
      <StatCard label="Operadoras com venda" value={number(active.length)} sublabel="no período e escopo" />
      <StatCard label="Maior participação" value={leader ? formatBasisPoints(leader.share) : "—"} sublabel={leader ? leader.name : "sem vendas no período"} />
      <StatCard label="Valor vendido" value={visibility.values ? money(totals.cents) : NO_VALUES} sublabel="vendas ativas no período" />
    </ErpStats>
    <PeriodToolbar current="operadoras" from={report.from} to={report.to} unit={report.unit} units={report.units} generatedAt={report.generatedAt} />
    <ErpList title="Vendas por operadora" columns={columns} rows={report.rows} rowKey={(row) => row.carrierId ?? "none"}
      count={report.rows.length} countLabel={["operadora", "operadoras"]}
      emptyTitle="Sem vendas no período" emptyText="Nenhuma venda registrada neste período e escopo." />
  </>;
}

// ─── Crescimento ────────────────────────────────────────────────────────────

type GrowthRow = Growth["rows"][number];

function Variation({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <span>{formatBasisPoints(value, true)}</span>;
}

export function GrowthView({ report }: { report: Growth }) {
  const { visibility, totals } = report;
  const hasData = report.rows.some((row) => row.count || row.previousCount);
  const columns: ErpColumn<GrowthRow>[] = [
    { id: "month", label: "Mês", primary: true, render: (row) => <MonthCell month={row.month} partial={row.partial} /> },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "previousCount", label: "Ano anterior", numeric: true, render: (row) => number(row.previousCount) },
    { id: "countYoy", label: "Variação", numeric: true, render: (row) => <Variation value={row.countYoy} /> },
    ...(visibility.values ? [
      { id: "cents", label: "Valor vendido", numeric: true, render: (row: GrowthRow) => money(row.cents) },
      { id: "previousCents", label: "Valor ano anterior", numeric: true, render: (row: GrowthRow) => money(row.previousCents) },
      { id: "centsYoy", label: "Variação do valor", numeric: true, render: (row: GrowthRow) => <Variation value={row.centsYoy} /> },
    ] : []),
  ];
  const chart = report.rows.map((row) => ({ month: row.month, atual: row.count, anterior: row.previousCount ?? 0 }));
  return <>
    <ErpStats>
      <StatCard label="Vendas em 12 meses" value={number(totals.count)} sublabel={`Ano anterior: ${number(totals.previousCount)}`} />
      <StatCard label="Variação das vendas" value={formatBasisPoints(totals.countYoy, true)} sublabel="contra os 12 meses anteriores" />
      <StatCard label="Valor vendido em 12 meses" value={visibility.values ? money(totals.cents) : NO_VALUES} sublabel="vendas ativas" />
      <StatCard label="Variação do valor" value={visibility.values ? formatBasisPoints(totals.centsYoy, true) : NO_VALUES} sublabel="contra os 12 meses anteriores" />
    </ErpStats>
    <ErpToolbar>
      <AnalyticsTabs current="crescimento" />
      <UnitFilter units={report.units} unit={report.unit} />
      <Freshness generatedAt={report.generatedAt} />
    </ErpToolbar>
    {hasData ? <ErpSection title="Vendas por mês e mesmo mês do ano anterior">
      <DsBarChart data={chart} xKey="month" xTickFormatter={monthTick} yAxisWidth={40} yTickFormatter={axisNumber}
        series={[{ key: "atual", label: "Últimos 12 meses" }, { key: "anterior", label: "Ano anterior" }]} />
    </ErpSection> : null}
    <ErpList title="Crescimento por mês" columns={columns} rows={hasData ? report.rows : []} rowKey={(row) => row.month}
      count={report.rows.length} countLabel={["mês", "meses"]}
      emptyTitle="Sem histórico" emptyText="Nenhuma venda nos últimos 24 meses neste escopo." />
  </>;
}

// ─── Análise diária ─────────────────────────────────────────────────────────

type DailyRow = Daily["rows"][number];

export function DailyView({ report }: { report: Daily }) {
  const { totals } = report;
  const hasData = Boolean(totals.count || totals.leads || totals.cancelled);
  const best = report.rows.reduce<DailyRow | null>((top, row) => ((row.count ?? 0) > (top?.count ?? 0) ? row : top), null);
  const columns: ErpColumn<DailyRow>[] = [
    { id: "day", label: "Dia", primary: true, render: (row) => <ErpCell title={dayLabel(row.day)} sub={weekday(row.day)} /> },
    { id: "count", label: "Vendas", numeric: true, render: (row) => number(row.count) },
    { id: "cancelled", label: "Canceladas", numeric: true, render: (row) => number(row.cancelled) },
    { id: "leads", label: "Leads recebidos", numeric: true, render: (row) => number(row.leads) },
  ];
  const chart = report.rows.filter((row) => !row.future).map((row) => ({ day: row.day, vendas: row.count ?? 0, leads: row.leads ?? 0 }));
  return <>
    <ErpStats>
      <StatCard label="Vendas no mês" value={number(totals.count)} sublabel={report.partial ? "mês em andamento" : "mês fechado"} />
      <StatCard label="Leads recebidos" value={number(totals.leads)} sublabel="pela data de entrada" />
      <StatCard label="Canceladas" value={number(totals.cancelled)} sublabel="fora do total de vendas" />
      <StatCard label="Melhor dia" value={best?.count ? dayLabel(best.day) : "—"} sublabel={best?.count ? plural(best.count, "venda", "vendas") : "sem vendas no mês"} />
    </ErpStats>
    <ErpToolbar>
      <AnalyticsTabs current="diario" />
      <ErpMonthFilter label="Mês" param="month" value={report.month} allLabel={null} />
      <UnitFilter units={report.units} unit={report.unit} />
      <Freshness generatedAt={report.generatedAt} />
    </ErpToolbar>
    {hasData ? <ErpSection title="Vendas e leads por dia">
      <DsBarChart data={chart} xKey="day" xTickFormatter={dayLabel} yAxisWidth={40} yTickFormatter={axisNumber}
        series={[{ key: "vendas", label: "Vendas" }, { key: "leads", label: "Leads recebidos" }]} />
    </ErpSection> : null}
    <ErpList title="Movimento por dia" columns={columns} rows={hasData ? report.rows : []} rowKey={(row) => row.day}
      count={report.rows.length} countLabel={["dia", "dias"]}
      emptyTitle="Sem movimento no mês" emptyText="Nenhuma venda ou lead recebido neste mês e escopo." />
  </>;
}

// ─── Metas ──────────────────────────────────────────────────────────────────

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
const goalPercent = (row: GoalRow) => (row.hideMoney || row.percentage === null ? null : Number(row.percentage));
const GOAL_TONE: Record<string, ErpTone> = { Vigente: "info", Futura: "neutral", Encerrada: "neutral" };

function GoalProgress({ row }: { row: GoalRow }) {
  const percent = goalPercent(row);
  if (percent === null) return <span className="text-muted-foreground">—</span>;
  const width = Math.max(0, Math.min(100, percent));
  return <span className={styles.share}>
    <span className={styles.track} aria-hidden="true"><span className={styles.fill} data-done={percent >= 100} style={{ width: `${width}%` }} /></span>
    {`${percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
  </span>;
}

export function GoalsView({ goals }: { goals: Goals }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const reached = goals.rows.filter((row) => (goalPercent(row) ?? 0) >= 100).length;
  const current = goals.rows.filter((row) => row.status === "Vigente");
  const rows = status === "all" ? goals.rows : goals.rows.filter((row) => row.status === status);
  const opened = goals.rows.find((row) => row.id === openId) ?? null;
  const columns: ErpColumn<GoalRow>[] = [
    { id: "name", label: "Meta", primary: true, render: (row) => <ErpCell title={row.name} sub={row.owner ? `${row.scopeLabel} · ${row.owner}` : row.scopeLabel} /> },
    { id: "period", label: "Período", nowrap: true, secondary: true, render: (row) => `${formatDay(row.startDate)} a ${formatDay(row.endDate)}` },
    { id: "target", label: "Alvo", numeric: true, render: (row) => goalValue(row.target, row.hideMoney) },
    { id: "current", label: "Atual", numeric: true, render: (row) => goalValue(row.current, row.hideMoney) },
    { id: "percentage", label: "Atingido", numeric: true, render: (row) => <GoalProgress row={row} /> },
    { id: "status", label: "Situação", render: (row) => <ErpStatus tone={(goalPercent(row) ?? 0) >= 100 ? "success" : GOAL_TONE[row.status] ?? "neutral"}>{(goalPercent(row) ?? 0) >= 100 ? "Atingida" : row.status}</ErpStatus> },
  ];
  const statusOptions = [{ value: "all", label: "Todas as situações" }, { value: "Vigente", label: "Vigentes" }, { value: "Futura", label: "Futuras" }, { value: "Encerrada", label: "Encerradas" }];
  return <>
    <ErpStats>
      <StatCard label="Metas no seu escopo" value={number(goals.rows.length)} sublabel="ativas" />
      <StatCard label="Vigentes" value={number(current.length)} sublabel="em andamento hoje" />
      <StatCard label="Atingidas" value={number(reached)} sublabel="pelo último progresso" />
      <StatCard label="Sem progresso" value={number(goals.rows.filter((row) => !row.calculatedAt).length)} sublabel="ainda não calculado" />
    </ErpStats>
    <ErpToolbar>
      <GoalStatusFilter value={status} options={statusOptions} onChange={setStatus} />
      <Freshness generatedAt={goals.generatedAt} />
    </ErpToolbar>
    <ErpList title="Metas" columns={columns} rows={rows} rowKey={(row) => row.id} onRowOpen={(row) => setOpenId(row.id)}
      count={rows.length} countLabel={["meta", "metas"]}
      emptyTitle={goals.rows.length ? "Nenhuma meta nesta situação" : "Nenhuma meta no seu escopo"}
      emptyText={goals.rows.length ? "Escolha outra situação para ver as demais metas." : "Quando a direção definir metas para você, sua equipe ou unidade, elas aparecem aqui."} />
    <ErpPanel open={opened !== null} onOpenChange={(next) => { if (!next) setOpenId(null); }} title={opened?.name ?? "Meta"}
      description={opened ? (opened.owner ? `${opened.scopeLabel} · ${opened.owner}` : opened.scopeLabel) : undefined}>
      {opened ? <dl className={styles.facts}>
        <div className={styles.fact}><dt>Situação</dt><dd>{opened.status}</dd></div>
        <div className={styles.fact}><dt>Período</dt><dd>{formatDay(opened.startDate)} a {formatDay(opened.endDate)}</dd></div>
        <div className={styles.fact}><dt>Alvo</dt><dd>{goalValue(opened.target, opened.hideMoney)}</dd></div>
        <div className={styles.fact}><dt>Atual</dt><dd>{goalValue(opened.current, opened.hideMoney)}</dd></div>
        <div className={styles.fact}><dt>Atingido</dt><dd><GoalProgress row={opened} /></dd></div>
        <div className={styles.fact}><dt>Progresso calculado em</dt><dd>{opened.calculatedAt ? formatInstant(opened.calculatedAt) : "Ainda não calculado"}</dd></div>
      </dl> : null}
    </ErpPanel>
  </>;
}

/** Local status filter (goals are few and already in memory): same look as the URL filters. */
function GoalStatusFilter({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  const skin = useErpSkin();
  if (skin === "lite") return <SegmentedControl className={styles.perspectives} label="Situação das metas" options={options.map((option) => ({ value: option.value, label: option.value === "all" ? "Todas" : option.label }))} value={value} onValueChange={onChange} />;
  return <DsSegmentedControl aria-label="Situação das metas" className={styles.perspectives} options={options.map((option) => ({ value: option.value, label: option.value === "all" ? "Todas" : option.label }))} value={value} onValueChange={onChange} />;
}

// ─── Error state ────────────────────────────────────────────────────────────

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
