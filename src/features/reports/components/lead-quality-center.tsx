import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Clock3,
  ContactRound,
  MapPin,
  Megaphone,
  UsersRound,
} from "lucide-react";

import { DashboardHeader } from "@/components/dashboard-header";
import { PeriodSelect } from "@/components/period-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PeriodValue } from "@/shared/period";
import { DashboardSectionTabs } from "@/features/dashboard/components/dashboard-section-tabs";
import type { LeadQualityDimension, LeadQualityReport, LeadQualitySegment } from "../metrics/lead-quality-service";

const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const hours = Array.from({ length: 24 }, (_, hour) => hour);

const dimensionLabels: Record<LeadQualityDimension, string> = {
  source: "Origem",
  campaign: "Campanha",
  adset: "Conjunto de anúncios",
  ad: "Anúncio",
  form: "Formulário",
  queue: "Fila atual",
  broker: "Corretor atual",
  lead_type: "Tipo de lead",
  plan_type: "Tipo de plano",
  city: "Cidade",
  age_band: "Faixa etária",
  hour: "Dia e horário",
};

function percent(value: number) {
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function numberLabel(value: number) {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function sourceLabel(value: string) {
  const labels: Record<string, string> = {
    landing_page: "Página de captura",
    website: "Site",
    manual: "Cadastro manual",
    webhook: "Integração",
    facebook: "Facebook",
    instagram: "Instagram",
    meta: "Meta",
    whatsapp: "WhatsApp",
    referral: "Indicação",
    unknown: "Origem não identificada",
  };
  return labels[value] ?? value.replaceAll("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function leadStatusLabel(status: string) {
  const labels: Record<string, string> = {
    new: "Novo",
    distributed: "Distribuído",
    in_contact: "Em atendimento",
    quote_sent: "Cotação enviada",
    negotiation: "Em negociação",
    documentation_pending: "Documentação pendente",
    under_analysis: "Em análise",
    converted: "Convertido",
    lost: "Perdido",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

function focusHref(period: PeriodValue, dimension: LeadQualityDimension, key: string) {
  const params = new URLSearchParams({ tab: "quality", dimension, key });
  if (period !== 30) params.set("period", String(period));
  return `/dashboard?${params.toString()}`;
}

function clearFocusHref(period: PeriodValue) {
  return period === 30 ? "/dashboard?tab=quality" : `/dashboard?tab=quality&period=${period}`;
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone = "primary",
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone?: "primary" | "emerald" | "amber" | "blue";
}) {
  const toneClass = {
    primary: "border-l-primary/70 bg-gradient-to-br from-primary/[0.045] to-card",
    emerald: "border-l-emerald-500/70 bg-gradient-to-br from-emerald-500/[0.045] to-card",
    amber: "border-l-amber-500/70 bg-gradient-to-br from-amber-500/[0.055] to-card",
    blue: "border-l-sky-500/70 bg-gradient-to-br from-sky-500/[0.05] to-card",
  }[tone];

  return (
    <Card className={`gap-3 border-l-[3px] ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-[1.75rem]">{value}</p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-background/70 text-muted-foreground">
          <Icon aria-hidden="true" className="size-4" />
        </span>
      </div>
      <p className="text-[11px] leading-4 text-muted-foreground">{detail}</p>
    </Card>
  );
}

function TemperatureCard({ report }: { report: LeadQualityReport }) {
  const rows = [
    { label: "Quente", value: report.summary.hot, share: report.summary.temperatureDistribution.hot, dot: "bg-rose-500", bar: "bg-rose-500" },
    { label: "Morno", value: report.summary.warm, share: report.summary.temperatureDistribution.warm, dot: "bg-amber-500", bar: "bg-amber-500" },
    { label: "Frio", value: report.summary.cold, share: report.summary.temperatureDistribution.cold, dot: "bg-sky-500", bar: "bg-sky-500" },
    { label: "Sem classificação", value: report.summary.unclassified, share: report.summary.temperatureDistribution.unclassified, dot: "bg-muted-foreground/50", bar: "bg-muted-foreground/40" },
  ];

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/8 text-primary"><Activity aria-hidden="true" className="size-4" /></span>
          <CardTitle>Temperatura registrada</CardTitle>
        </div>
        <CardDescription>Classificação atual salva no lead. O score não é tratado como chance de venda.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`Distribuição de temperatura em ${numberLabel(report.summary.total)} leads`}>
          {rows.map((row) => (
            <span key={row.label} className={row.bar} style={{ width: `${report.summary.total ? row.value / report.summary.total * 100 : 0}%` }} />
          ))}
        </div>
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3">
              <span className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
                <span className={`size-2 rounded-full ${row.dot}`} />{row.label}
              </span>
              <span className="text-sm font-semibold tabular-nums text-foreground">{numberLabel(row.value)}</span>
              <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">{percent(row.share)}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <span>{numberLabel(report.summary.classified)} classificados</span>
          <span>{percent(report.summary.classificationCoverage)} de cobertura</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SegmentTable({
  title,
  description,
  dimension,
  rows,
  period,
  icon: Icon,
  metaOnly = false,
}: {
  title: string;
  description: string;
  dimension: LeadQualityDimension;
  rows: LeadQualitySegment[];
  period: PeriodValue;
  icon: typeof Activity;
  metaOnly?: boolean;
}) {
  const visibleRows = metaOnly ? rows.filter((row) => row.key !== "__unknown__") : rows;

  return (
    <Card className="min-w-0 gap-0 overflow-hidden p-0">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/70 bg-muted/45 text-muted-foreground"><Icon aria-hidden="true" className="size-4" /></span>
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <p className="px-5 pb-3 text-[11px] leading-4 text-muted-foreground">Quentes/mornos são percentuais entre os classificados; convertidos são o status atual sobre o total do grupo.</p>
      {visibleRows.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{dimensionLabels[dimension]}</TableHead>
              <TableHead className="text-right">Leads</TableHead>
              <TableHead className="text-right">Quentes + mornos</TableHead>
              <TableHead className="text-right">Convertidos*</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row) => {
              const label = dimension === "source" ? sourceLabel(row.label) : row.label;
              const warmHot = row.hot + row.warm;
              return (
                <TableRow key={`${dimension}-${row.key}`}>
                  <TableCell className="max-w-[250px]">
                    <Link href={focusHref(period, dimension, row.key)} className="block truncate font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      {label}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{numberLabel(row.total)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span className="font-medium">{numberLabel(warmHot)}</span>
                    <span className="ml-1 text-xs text-muted-foreground">{percent(row.hotWarmShare)}</span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {numberLabel(row.converted)}<span className="ml-1 text-xs text-muted-foreground">{percent(row.conversionRate)}</span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="mx-5 mb-5 rounded-xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
          Nenhum grupo com {3}+ leads neste recorte.
        </div>
      )}
      <div className="border-t border-border/60 px-5 py-2.5 text-[10px] text-muted-foreground">*Conversões no status atual. Exibimos apenas grupos com ao menos 3 leads.</div>
    </Card>
  );
}

function HourHeatmap({ report }: { report: LeadQualityReport }) {
  const values = new Map(report.segments.hour.map((row) => [row.key, row]));
  const max = Math.max(3, ...report.segments.hour.map((row) => row.total));
  const hrefFor = (key: string) => focusHref(report.period, "hour", key);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/8 text-primary"><Clock3 aria-hidden="true" className="size-4" /></span>
          <CardTitle>Quando os leads chegam</CardTitle>
        </div>
        <CardDescription>Dia da semana × hora de criação, no fuso de Brasília. Células com menos de 3 leads são ocultadas.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto pb-1">
          <div className="min-w-[760px]">
            <div className="grid grid-cols-[52px_repeat(24,minmax(20px,1fr))] gap-1">
              <span aria-hidden="true" />
              {hours.map((hour) => <span key={hour} className="text-center text-[9px] tabular-nums text-muted-foreground">{hour.toString().padStart(2, "0")}</span>)}
              {weekdays.map((day, dayIndex) => (
                <div key={day} className="contents">
                  <span className="flex items-center text-xs font-medium text-muted-foreground">{day}</span>
                  {hours.map((hour) => {
                    const key = `${dayIndex}:${hour}`;
                    const row = values.get(key);
                    const count = row?.total ?? 0;
                    const intensity = count >= max * 0.72 ? "bg-primary text-primary-foreground" : count >= max * 0.42 ? "bg-primary/70 text-primary-foreground" : count >= max * 0.22 ? "bg-primary/40 text-foreground" : "bg-primary/20 text-foreground";
                    return row ? (
                      <Link
                        key={key}
                        href={hrefFor(key)}
                        aria-label={`${day}, ${hour} horas: ${count} leads. Abrir registros`}
                        title={`${day}, ${hour.toString().padStart(2, "0")}:00 — ${count} leads`}
                        className={`grid aspect-square min-h-5 place-items-center rounded-[4px] text-[9px] font-semibold tabular-nums ring-offset-background transition-colors hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${intensity}`}
                      >
                        {count}
                      </Link>
                    ) : (
                      <span key={key} aria-label={`${day}, ${hour} horas: sem amostra suficiente`} title="Sem amostra suficiente" className="aspect-square min-h-5 rounded-[4px] bg-muted/65" />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-1.5 text-[10px] text-muted-foreground" aria-hidden="true">
          <span>Menos</span><span className="size-3 rounded-sm bg-primary/20" /><span className="size-3 rounded-sm bg-primary/40" /><span className="size-3 rounded-sm bg-primary/70" /><span className="size-3 rounded-sm bg-primary" /><span>Mais leads</span>
        </div>
      </CardContent>
    </Card>
  );
}

function FocusedLeads({ report }: { report: LeadQualityReport }) {
  if (!report.focus) return null;
  const label = report.segments[report.focus.dimension].find((row) => row.key === report.focus?.key)?.label ?? report.focus.key;

  return (
    <Card id="registros" className="scroll-mt-24 gap-0 overflow-hidden p-0">
      <CardHeader className="p-5 pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Leads deste recorte</CardTitle>
            <CardDescription className="mt-1">{dimensionLabels[report.focus.dimension]} · {label} · {numberLabel(report.focusedLeadCount)} registros</CardDescription>
          </div>
          <Link href={clearFocusHref(report.period)} className="text-xs font-medium text-primary underline-offset-4 hover:underline">Limpar recorte</Link>
        </div>
      </CardHeader>
      {report.focusedLeads.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Status atual</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Fila atual</TableHead>
              <TableHead>Corretor atual</TableHead>
              <TableHead>Recebido em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.focusedLeads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="max-w-[220px]">
                  <Link href={`/leads/${encodeURIComponent(lead.id)}`} className="block truncate font-medium text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{lead.name}</Link>
                </TableCell>
                <TableCell><Badge variant={lead.status === "converted" ? "success" : lead.status === "lost" ? "outline" : "secondary"}>{leadStatusLabel(lead.status)}</Badge></TableCell>
                <TableCell><TemperatureBadge status={lead.qualificationStatus} /></TableCell>
                <TableCell className="max-w-[150px] truncate">{lead.queueName ?? "—"}</TableCell>
                <TableCell className="max-w-[180px] truncate">{lead.brokerName ?? "Sem atribuição"}</TableCell>
                <TableCell className="text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(lead.createdAt))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="mx-5 mb-5 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">Este grupo tem menos de 3 leads ou nenhum registro ativo para exibir.</div>
      )}
      <div className="border-t border-border/60 px-5 py-2.5 text-[10px] text-muted-foreground">{report.focusedLeadCount > report.focusedLeads.length ? `Mostrando ${report.focusedLeads.length} de ${numberLabel(report.focusedLeadCount)} leads. ` : ""}Telefone e e-mail não são exibidos aqui; abra o lead para ver detalhes autorizados.</div>
    </Card>
  );
}

function TemperatureBadge({ status }: { status: string }) {
  if (status === "hot") return <Badge variant="destructive">Quente</Badge>;
  if (status === "warm") return <Badge variant="warning">Morno</Badge>;
  if (status === "cold") return <Badge variant="info">Frio</Badge>;
  return <Badge variant="outline">Sem classe</Badge>;
}

function FocusBanner({ report }: { report: LeadQualityReport }) {
  if (!report.focus) return null;
  const row = report.segments[report.focus.dimension].find((segment) => segment.key === report.focus?.key);
  const label = row?.label ?? report.focus.key;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/[0.045] px-4 py-3">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="info">Recorte ativo</Badge>
        <span className="text-muted-foreground">{dimensionLabels[report.focus.dimension]}:</span>
        <span className="font-semibold text-foreground">{label}</span>
        <span className="text-muted-foreground">· {numberLabel(report.summary.total)} leads</span>
      </div>
      <Link href={clearFocusHref(report.period)} className="text-xs font-medium text-primary underline-offset-4 hover:underline">Ver coorte completa</Link>
    </div>
  );
}

export function LeadQualityCenter({ report, showQualityTab = true }: { report: LeadQualityReport; showQualityTab?: boolean }) {
  const warmHot = report.summary.hot + report.summary.warm;
  const period = report.period;

  return (
    <>
      <DashboardHeader
        breadcrumb="Operação comercial"
        title="Qualidade dos leads"
        rightSlot={
          <PeriodSelect
            value={period}
            label="Período da análise de qualidade"
            triggerClassName="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground hover:bg-muted"
          />
        }
      />
      <main className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {report.enabled ? <DashboardSectionTabs active="quality" period={period} showQuality={showQualityTab} /> : null}

        {!report.enabled ? (
          <Card className="mx-auto w-full max-w-2xl gap-3 border-dashed py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Activity aria-hidden="true" className="size-5" /></span>
            <CardTitle>Central temporariamente indisponível</CardTitle>
            <CardDescription>A Central de Relatórios foi desativada pelo Super-admin. A visão da operação continua disponível.</CardDescription>
            <Link href="/dashboard" className="mx-auto mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline">Voltar ao dashboard</Link>
          </Card>
        ) : report.summary.total === 0 ? (
          <>
            <Intro period={period} />
            <Card className="items-center gap-2 border-dashed px-6 py-14 text-center">
              <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground"><Megaphone aria-hidden="true" className="size-5" /></span>
              <CardTitle>Nenhum lead neste período</CardTitle>
              <CardDescription>Não há leads visíveis no seu escopo neste período. Escolha uma janela maior ou volte depois que novos leads entrarem na operação.</CardDescription>
            </Card>
          </>
        ) : (
          <>
            <Intro period={period} />
            <FocusBanner report={report} />

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principais">
              <MetricCard title="Leads recebidos" value={numberLabel(report.summary.total)} detail={`Coorte dos últimos ${period} dias`} icon={ContactRound} tone="blue" />
              <MetricCard title="Quentes + mornos" value={numberLabel(warmHot)} detail={`${percent(report.summary.hotWarmShare)} dos que têm temperatura`} icon={ArrowUpRight} tone="emerald" />
              <MetricCard title="Classificação registrada" value={percent(report.summary.classificationCoverage)} detail={`${numberLabel(report.summary.classified)} com temperatura persistida`} icon={BadgeCheck} tone="amber" />
              <MetricCard title="Com anúncio Meta" value={percent(report.summary.metaAdAttributionCoverage)} detail={`${numberLabel(report.summary.metaAttributed)} com ID de anúncio confirmado`} icon={Megaphone} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]" aria-label="Temperatura e resultado">
              <TemperatureCard report={report} />
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><ArrowDownRight aria-hidden="true" className="size-4" /></span>
                    <CardTitle>O que aconteceu com essa coorte</CardTitle>
                  </div>
                  <CardDescription>Status e atribuição atuais; não é um retrato histórico da temperatura no momento da entrada.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs text-muted-foreground">Convertidos hoje</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{numberLabel(report.summary.converted)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{percent(report.summary.conversionRate)} da coorte</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs text-muted-foreground">Quentes/mornos convertidos</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{numberLabel(report.summary.hotWarmConverted)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{percent(report.summary.hotWarmConversionRate)} de quentes/mornos</p>
                  </div>
                  <div className="rounded-xl border border-border/70 bg-muted/25 p-4">
                    <p className="text-xs text-muted-foreground">Com corretor atual</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums">{numberLabel(report.summary.assigned)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{percent(report.summary.assignedRate)} da coorte</p>
                  </div>
                </CardContent>
                <div className="mx-5 mt-1 flex items-center gap-2 rounded-lg bg-muted/35 px-3 py-2 text-xs text-muted-foreground">
                  <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                  <span>Tempo médio até o 1º contato: {report.summary.averageFirstContactSeconds == null ? "sem registros" : `${Math.round(report.summary.averageFirstContactSeconds / 60).toLocaleString("pt-BR")} min`}</span>
                </div>
              </Card>
            </section>

            <section className="space-y-3" aria-labelledby="acquisition-heading">
              <div className="flex items-end justify-between gap-3 px-1">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Aquisição</p>
                  <h2 id="acquisition-heading" className="mt-1 text-lg font-semibold tracking-tight">Campanhas e anúncios</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Origem por IDs Meta salvos no lead. Sem estimativa de investimento, CPL ou CPA.</p>
                </div>
                <Badge variant="outline">{numberLabel(report.summary.metaAttributed)} IDs de anúncio</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <SegmentTable title="Anúncios com maior volume" description="Quentes/mornos e conversões no status atual." dimension="ad" rows={report.segments.ad} period={period} icon={Megaphone} metaOnly />
                <SegmentTable title="Campanhas" description="Compare qualidade entre campanhas identificadas." dimension="campaign" rows={report.segments.campaign} period={period} icon={Activity} metaOnly />
                <SegmentTable title="Conjuntos de anúncios" description="Padrões por público/conjunto registrado na Meta." dimension="adset" rows={report.segments.adset} period={period} icon={UsersRound} metaOnly />
                <SegmentTable title="Formulários" description="Leads atribuídos a formulários identificados." dimension="form" rows={report.segments.form} period={period} icon={ContactRound} metaOnly />
                <SegmentTable title="Canais de entrada" description="Canal registrado no momento da captura." dimension="source" rows={report.segments.source} period={period} icon={Megaphone} />
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="operation-heading">
              <div className="px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Operação</p>
                <h2 id="operation-heading" className="mt-1 text-lg font-semibold tracking-tight">Para onde foram e quem atende</h2>
                <p className="mt-1 text-xs text-muted-foreground">Fila e corretor refletem a atribuição atual do lead.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <SegmentTable title="Filas atuais" description="Volume e qualidade por fila responsável hoje." dimension="queue" rows={report.segments.queue} period={period} icon={ContactRound} />
                <SegmentTable title="Corretores atuais" description="Leitura de carteira; não representa histórico de transferência." dimension="broker" rows={report.segments.broker} period={period} icon={UsersRound} />
              </div>
            </section>

            <section className="space-y-3" aria-labelledby="profile-heading">
              <div className="px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Perfil</p>
                <h2 id="profile-heading" className="mt-1 text-lg font-semibold tracking-tight">Quem está chegando</h2>
                <p className="mt-1 text-xs text-muted-foreground">Recortes agregados; idade aparece em faixas e grupos pequenos são ocultados.</p>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <SegmentTable title="Tipo de lead e plano" description="Perfil comercial registrado na qualificação." dimension="lead_type" rows={report.segments.lead_type} period={period} icon={ContactRound} />
                <SegmentTable title="Tipo de plano" description="Plano individual, familiar ou empresarial informado." dimension="plan_type" rows={report.segments.plan_type} period={period} icon={BadgeCheck} />
                <SegmentTable title="Cidades" description="Localidade informada pelo lead." dimension="city" rows={report.segments.city} period={period} icon={MapPin} />
                <SegmentTable title="Faixa etária" description="A partir da idade individual ou média persistida, quando numérica." dimension="age_band" rows={report.segments.age_band} period={period} icon={UsersRound} />
              </div>
            </section>

            <HourHeatmap report={report} />
            <FocusedLeads report={report} />

            <p className="px-1 text-[11px] leading-5 text-muted-foreground">
              Coorte por data de criação. Temperatura, status, fila e corretor são valores atuais; mudanças passadas não têm snapshot nesta versão. Categorias com menos de 3 leads não são mostradas. Nomes e detalhes pessoais só aparecem após selecionar um recorte autorizado.
            </p>
          </>
        )}
      </main>
    </>
  );
}

function Intro({ period }: { period: PeriodValue }) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.085] via-card to-card p-5 sm:p-6" aria-label="Sobre a análise">
      <div aria-hidden="true" className="absolute -right-10 -top-16 -z-10 size-56 rounded-full bg-primary/[0.06] blur-3xl" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <Badge variant="info" className="mb-3">INTELIGÊNCIA DE AQUISIÇÃO</Badge>
          <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Da origem do lead aos sinais de qualidade.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Compare temperatura, anúncio, perfil, fila e horário para identificar os padrões que merecem atenção — com caminho até os leads que formam cada recorte.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
          <Clock3 aria-hidden="true" className="size-3.5" /> Últimos {period} dias
        </div>
      </div>
    </section>
  );
}
