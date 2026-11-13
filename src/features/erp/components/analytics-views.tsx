"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AppSelect } from "@/components/ui/select";
import { DsBarChart } from "@/components/ui/ds-bar-chart";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import page from "@/components/lite/page/lite-page.module.css";
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
const number = (value: number | null) => (value === null ? "—" : value.toLocaleString("pt-BR"));
const money = (value: number | null) => (value === null ? "—" : formatCents(value));
const dayLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const weekday = (day: string) => new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`)).replace(".", "");

function Num({ children }: { children: ReactNode }) {
  return <TableCell className="text-right tabular-nums">{children}</TableCell>;
}
function NumHead({ children }: { children: ReactNode }) {
  return <TableHead className="text-right">{children}</TableHead>;
}

function UnitSelect({ units, unit }: { units: Unit[]; unit: string }) {
  if (!units.length) return null;
  return <AppSelect name="unit" aria-label="Unidade" defaultValue={unit || "all"} options={[{ value: "all", label: "Todas as unidades do seu escopo" }, ...units.map((item) => ({ value: item.id, label: item.name }))]} />;
}

export function PeriodFilters({ action, from, to, unit, units }: { action: string; from: string; to: string; unit: string; units: Unit[] }) {
  return <form action={action} className={page.toolbar} aria-label="Filtrar indicadores">
    <Input name="from" type="month" defaultValue={from} aria-label="Mês inicial" required />
    <Input name="to" type="month" defaultValue={to} aria-label="Mês final" required />
    <UnitSelect units={units} unit={unit} />
    <Button type="submit" variant="outline">Aplicar</Button>
  </form>;
}

export function MonthFilter({ action, month, unit, units }: { action: string; month: string; unit: string; units: Unit[] }) {
  return <form action={action} className={page.toolbar} aria-label="Filtrar indicadores">
    <Input name="month" type="month" defaultValue={month} aria-label="Mês" required />
    <UnitSelect units={units} unit={unit} />
    <Button type="submit" variant="outline">Aplicar</Button>
  </form>;
}

export function UnitFilter({ action, unit, units }: { action: string; unit: string; units: Unit[] }) {
  if (!units.length) return null;
  return <form action={action} className={page.toolbar} aria-label="Filtrar indicadores">
    <UnitSelect units={units} unit={unit} />
    <Button type="submit" variant="outline">Aplicar</Button>
  </form>;
}

/** Freshness and calculation memory for every analytics screen. */
export function SourceNote({ generatedAt, metrics, children }: { generatedAt: string; metrics: readonly MetricDefinition[]; children?: ReactNode }) {
  return <section className="flex flex-col gap-2 text-sm text-muted-foreground" aria-label="Origem dos dados">
    <p>Atualizado em {formatDateTime(generatedAt)} (consulta direta, horário de Brasília).{children ? <> {children}</> : null}</p>
    <details className="rounded-md border border-border px-3 py-2">
      <summary className="cursor-pointer font-medium text-foreground">Memória de cálculo</summary>
      <dl className="mt-2 flex flex-col gap-2">
        {metrics.map((metric) => <div key={metric.id}>
          <dt className="font-medium text-foreground">{metric.label} <span className="font-normal text-muted-foreground">· {metric.id} v{metric.version} · {metric.unit === "cents" ? "R$" : "contagem"}</span></dt>
          <dd>{metric.description} Fonte: {metric.fact}. Data considerada: {metric.dateBasis}.</dd>
        </div>)}
      </dl>
    </details>
  </section>;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <section className={page.empty}><h2 className={page.emptyTitle}>{title}</h2><p className={page.emptyText}>{text}</p></section>;
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className={page.stat}><p className={page.statLabel}>{label}</p><p className={page.statValue}>{value}</p>{hint ? <p className={page.statHint}>{hint}</p> : null}</div>;
}

function MonthCell({ month, partial }: { month: string; partial: boolean }) {
  return <TableCell><span className="capitalize">{monthLabel(month)}</span>{partial ? <> <Badge variant="outline">parcial</Badge></> : null}</TableCell>;
}

export function ProductionView({ report }: { report: Production }) {
  const hasData = report.rows.some((row) => row.count || row.cancelled || row.implanted || row.cash);
  return <>
    <section className={page.stats} aria-label="Totais do período">
      <Stat label="Vendas" value={number(report.totals.count)} hint={`${number(report.totals.cancelled)} cancelada(s) fora do total`} />
      <Stat label="Valor vendido" value={report.visibility.values ? money(report.totals.cents) : NO_VALUES} />
      <Stat label="Implantações" value={number(report.totals.implanted)} />
      <Stat label="Recebido pela corretora" value={report.visibility.cash ? money(report.totals.cash) : NO_VALUES} />
    </section>
    {hasData ? <>
      <section className={page.card} aria-label="Vendas por mês">
        <div className={page.cardHead}><h2 className={page.cardTitle}>Vendas por mês</h2></div>
        <DsBarChart data={report.rows.map((row) => ({ month: row.month, vendas: row.count, implantacoes: row.implanted }))} xKey="month" xTickFormatter={monthLabel}
          series={[{ key: "vendas", label: "Vendas" }, { key: "implantacoes", label: "Implantações" }]} />
      </section>
      <Table>
        <TableHeader><TableRow><TableHead>Mês</TableHead><NumHead>Vendas</NumHead><NumHead>Canceladas</NumHead><NumHead>Valor vendido</NumHead><NumHead>Implantações</NumHead><NumHead>Recebido</NumHead></TableRow></TableHeader>
        <TableBody>{report.rows.map((row) => <TableRow key={row.month}>
          <MonthCell month={row.month} partial={row.partial} /><Num>{number(row.count)}</Num><Num>{number(row.cancelled)}</Num>
          <Num>{report.visibility.values ? money(row.cents) : "—"}</Num><Num>{number(row.implanted)}</Num><Num>{report.visibility.cash ? money(row.cash) : "—"}</Num>
        </TableRow>)}</TableBody>
        <TableFooter><TableRow><TableCell>Total</TableCell><Num>{number(report.totals.count)}</Num><Num>{number(report.totals.cancelled)}</Num><Num>{report.visibility.values ? money(report.totals.cents) : "—"}</Num><Num>{number(report.totals.implanted)}</Num><Num>{report.visibility.cash ? money(report.totals.cash) : "—"}</Num></TableRow></TableFooter>
      </Table>
      {report.drillHref ? <p className="text-sm"><Link className="text-primary underline-offset-4 hover:underline" href={report.drillHref}>Ver as vendas na lista de vendas</Link></p> : null}
    </> : <Empty title="Sem produção no período" text="Nenhuma venda, implantação ou recebimento confirmado neste período e escopo." />}
    {!report.visibility.values || !report.visibility.cash ? <p className="text-sm text-muted-foreground">Valores aparecem apenas para quem tem acesso a eles no seu escopo.</p> : null}
  </>;
}

export function CarrierView({ report }: { report: Carriers }) {
  if (!report.rows.length) return <Empty title="Sem vendas no período" text="Nenhuma venda registrada neste período e escopo." />;
  return <>
    <section className={page.stats} aria-label="Totais do período">
      <Stat label="Vendas" value={number(report.totals.count)} hint={`${number(report.totals.cancelled)} cancelada(s) fora do total`} />
      <Stat label="Operadoras" value={number(report.rows.filter((row) => row.count > 0).length)} />
      <Stat label="Valor vendido" value={report.visibility.values ? money(report.totals.cents) : NO_VALUES} />
    </section>
    <Table>
      <TableHeader><TableRow><TableHead>Operadora</TableHead><NumHead>Vendas</NumHead><NumHead>Participação</NumHead><NumHead>Valor vendido</NumHead><NumHead>Part. no valor</NumHead><NumHead>Canceladas</NumHead></TableRow></TableHeader>
      <TableBody>{report.rows.map((row) => <TableRow key={row.carrierId ?? "none"}>
        <TableCell className={row.carrierId ? undefined : "text-muted-foreground"}>{row.name}</TableCell><Num>{number(row.count)}</Num><Num>{formatBasisPoints(row.share)}</Num>
        <Num>{report.visibility.values ? money(row.cents) : "—"}</Num><Num>{formatBasisPoints(row.valueShare)}</Num><Num>{number(row.cancelled)}</Num>
      </TableRow>)}</TableBody>
    </Table>
    <p className="text-sm text-muted-foreground">“Não informada” reúne vendas sem plano de operadora vinculado. A participação usa só vendas ativas.</p>
  </>;
}

export function GrowthView({ report }: { report: Growth }) {
  if (!report.rows.some((row) => row.count || row.previousCount)) return <Empty title="Sem histórico" text="Nenhuma venda nos últimos 24 meses neste escopo." />;
  return <>
    <section className={page.card} aria-label="Vendas por mês e ano anterior">
      <div className={page.cardHead}><h2 className={page.cardTitle}>Vendas: mês atual e mesmo mês do ano anterior</h2></div>
      <DsBarChart data={report.rows.map((row) => ({ month: row.month, atual: row.count, anterior: row.previousCount ?? 0 }))} xKey="month" xTickFormatter={monthLabel}
        series={[{ key: "atual", label: "Período" }, { key: "anterior", label: "Ano anterior" }]} />
    </section>
    <Table>
      <TableHeader><TableRow><TableHead>Mês</TableHead><NumHead>Vendas</NumHead><NumHead>Ano anterior</NumHead><NumHead>Variação</NumHead><NumHead>Valor vendido</NumHead><NumHead>Ano anterior</NumHead><NumHead>Variação</NumHead></TableRow></TableHeader>
      <TableBody>{report.rows.map((row) => <TableRow key={row.month}>
        <MonthCell month={row.month} partial={row.partial} /><Num>{number(row.count)}</Num><Num>{number(row.previousCount)}</Num><Num>{formatBasisPoints(row.countYoy, true)}</Num>
        <Num>{report.visibility.values ? money(row.cents) : "—"}</Num><Num>{report.visibility.values ? money(row.previousCents) : "—"}</Num><Num>{formatBasisPoints(row.centsYoy, true)}</Num>
      </TableRow>)}</TableBody>
    </Table>
    <p className="text-sm text-muted-foreground">“—” na variação: sem base no ano anterior (zero ou sem registro). Mês parcial compara dias incompletos com o mês fechado do ano anterior.</p>
  </>;
}

export function DailyView({ report }: { report: Daily }) {
  if (!report.totals.count && !report.totals.leads && !report.totals.cancelled) return <Empty title="Sem movimento no mês" text="Nenhuma venda ou lead recebido neste mês e escopo." />;
  return <>
    <section className={page.stats} aria-label="Totais do mês">
      <Stat label="Vendas no mês" value={number(report.totals.count)} hint={report.partial ? "Mês em andamento" : undefined} />
      <Stat label="Leads recebidos" value={number(report.totals.leads)} />
      <Stat label="Canceladas" value={number(report.totals.cancelled)} />
    </section>
    <section className={page.card} aria-label="Vendas e leads por dia">
      <div className={page.cardHead}><h2 className={page.cardTitle}>Vendas e leads por dia</h2></div>
      <DsBarChart data={report.rows.filter((row) => !row.future).map((row) => ({ day: row.day, vendas: row.count ?? 0, leads: row.leads ?? 0 }))} xKey="day" xTickFormatter={dayLabel}
        series={[{ key: "vendas", label: "Vendas (data da venda)" }, { key: "leads", label: "Leads (data de entrada)" }]} />
    </section>
    <Table>
      <TableHeader><TableRow><TableHead>Dia</TableHead><NumHead>Vendas</NumHead><NumHead>Canceladas</NumHead><NumHead>Leads recebidos</NumHead></TableRow></TableHeader>
      <TableBody>{report.rows.map((row) => <TableRow key={row.day}>
        <TableCell>{dayLabel(row.day)} <span className="text-muted-foreground">{weekday(row.day)}</span></TableCell>
        <Num>{number(row.count)}</Num><Num>{number(row.cancelled)}</Num><Num>{number(row.leads)}</Num>
      </TableRow>)}</TableBody>
    </Table>
    <p className="text-sm text-muted-foreground">Cada dia mostra o que aconteceu nele: a venda pela data da venda e o lead pela data de entrada. Não há média nem divisão por 30; dias futuros aparecem como “—”.</p>
  </>;
}

const goalValue = (value: Goals["rows"][number]["target"], hidden: boolean) => {
  if (hidden) return NO_VALUES;
  if (!value) return "—";
  if (value.kind === "cents") return money(value.value);
  const numeric = Number(value.value);
  const text = Number.isFinite(numeric) ? numeric.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : value.value;
  return value.kind === "percent" ? `${text}%` : value.kind === "minutes" ? `${text} min` : text;
};
const shortDate = (iso: string) => new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(iso));

export function GoalsView({ goals }: { goals: Goals }) {
  return <>
    <p className="text-sm text-muted-foreground">{goals.manageHref ? <>Consulta somente leitura. As metas são definidas em <Link className="text-primary underline-offset-4 hover:underline" href={goals.manageHref}>Gestão</Link>.</> : "Consulta somente leitura. As metas são definidas pela direção."}</p>
    {goals.rows.length ? <Table>
      <TableHeader><TableRow><TableHead>Meta</TableHead><TableHead>Abrangência</TableHead><TableHead>Período</TableHead><NumHead>Alvo</NumHead><NumHead>Atual</NumHead><NumHead>Atingido</NumHead><TableHead>Situação</TableHead></TableRow></TableHeader>
      <TableBody>{goals.rows.map((row) => <TableRow key={row.id}>
        <TableCell><p className={page.cellTitle}>{row.name}</p>{row.calculatedAt ? <p className={page.cellSub}>Progresso calculado em {formatDateTime(row.calculatedAt)}</p> : <p className={page.cellSub}>Progresso ainda não calculado</p>}</TableCell>
        <TableCell>{row.scopeLabel}{row.owner ? <p className={page.cellSub}>{row.owner}</p> : null}</TableCell>
        <TableCell>{shortDate(row.startDate)} a {shortDate(row.endDate)}</TableCell>
        <Num>{goalValue(row.target, row.hideMoney)}</Num><Num>{goalValue(row.current, row.hideMoney)}</Num>
        <Num>{row.hideMoney || row.percentage === null ? "—" : `${Number(row.percentage).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}</Num>
        <TableCell><Badge variant={row.status === "Vigente" ? "default" : "outline"}>{row.status}</Badge></TableCell>
      </TableRow>)}</TableBody>
    </Table> : <Empty title="Nenhuma meta no seu escopo" text="Quando a direção definir metas para você, sua equipe ou unidade, elas aparecem aqui." />}
    <p className="text-sm text-muted-foreground">Atualizado em {formatDateTime(goals.generatedAt)}. Fonte: metas ativas e o último progresso calculado pelo módulo de metas.</p>
  </>;
}

const PERSPECTIVES = [
  { href: "/relatorios/producao", label: "Produção" }, { href: "/relatorios/operadoras", label: "Operadoras" },
  { href: "/relatorios/crescimento", label: "Crescimento" }, { href: "/relatorios/diario", label: "Análise diária" },
] as const;

export function AnalyticsNav({ current }: { current: (typeof PERSPECTIVES)[number]["href"] }) {
  return <nav aria-label="Perspectivas de inteligência" className="flex flex-wrap gap-2">
    {PERSPECTIVES.map((item) => <Button key={item.href} variant={item.href === current ? "secondary" : "ghost"} aria-current={item.href === current ? "page" : undefined} render={<Link href={item.href} />}>{item.label}</Button>)}
  </nav>;
}

export function AnalyticsError({ title, reset, clearHref }: { title: string; reset: () => void; clearHref: string }) {
  return <main className={page.stack}><section className={page.empty} role="alert"><h2 className={page.emptyTitle}>{title}</h2><p className={page.emptyText}>Confira se o módulo está liberado para seu perfil e se o período e a unidade são válidos. Se estava funcionando, tente novamente.</p><div className="flex flex-wrap justify-center gap-2"><Button onClick={reset}>Tentar novamente</Button><Button variant="outline" render={<Link href={clearHref} />}>Limpar filtros</Button><Button variant="outline" render={<Link href="/dashboard" />}>Voltar ao início</Button></div></section></main>;
}
