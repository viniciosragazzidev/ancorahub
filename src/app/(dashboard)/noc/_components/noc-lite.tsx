"use client";

/**
 * NOC no visual Lite. Mesmos dados e destinos da tela atual (NocClient), em outra ordem de leitura:
 * situação e período, números do período, anomalias, mapa por unidade, tabela de unidades, gráficos e o feed.
 * Só tokens: cores de gráfico em var(--chart-N), estados em success/warning/danger, nenhum gradiente nem loop infinito.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight, CircleCheck, Info, Search, Zap } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteUrlSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { liteDateFormatter } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { INITIAL_DIMENSION } from "@/components/ui/chart";
import type { BranchHealth, NocData } from "@/features/noc/queries";
import { formatCurrency } from "@/features/quotes/utils";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, type PeriodValue } from "@/shared/period";

import styles from "./noc-lite.module.css";

/** Serviços de infraestrutura: a lista fixa da tela atual (não há medição real por trás). */
const SERVICES = [
  { name: "API principal", uptime: "99,97%", latency: "45 ms" },
  { name: "Banco de dados", uptime: "99,99%", latency: "12 ms" },
  { name: "Webhook", uptime: "99,88%", latency: "120 ms" },
  { name: "WhatsApp", uptime: "99,95%", latency: "230 ms" },
  { name: "E-mail", uptime: "99,7%", latency: "480 ms" },
  { name: "CDN", uptime: "100%", latency: "28 ms" },
] as const;

const HEALTH = {
  healthy: { label: "Saudável", tone: "success" },
  attention: { label: "Atenção", tone: "warning" },
  critical: { label: "Crítico", tone: "danger" },
} as const;

/** Hora do retrato dos dados (instante do servidor), igual no HTML do servidor e do navegador. */
const updatedAt = liteDateFormatter({ hour: "2-digit", minute: "2-digit" });

const AXIS_TICK = { fill: "var(--text-secondary)", fontSize: 12 };

export function formatSeconds(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return "Sem dado";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes === 0) return `${rest}s`;
  return `${minutes}min ${String(rest).padStart(2, "0")}s`;
}

function formatDelta(delta: number, unit = "%") {
  return `${delta >= 0 ? "+" : ""}${delta.toLocaleString("pt-BR")}${unit}`;
}

/** Tempo relativo contra o instante do servidor (`now`), para o HTML do servidor e do navegador baterem. */
export function relativeTime(time: Date | string, now: string) {
  const diff = Math.max(0, Math.floor((new Date(now).getTime() - new Date(time).getTime()) / 1000));
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86_400) return `há ${Math.floor(diff / 3600)} h`;
  return `há ${Math.floor(diff / 86_400)} d`;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      <p className={page.cellTitle}>{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className={styles.tooltipRow}>
          <span className={styles.dot} style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: <span className={page.numeric}>{entry.value.toLocaleString("pt-BR")}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }: { items: Array<{ label: string; color: string }> }) {
  return (
    <ul className={styles.legend}>
      {items.map((item) => (
        <li key={item.label}><span className={styles.dot} style={{ background: item.color }} aria-hidden="true" />{item.label}</li>
      ))}
    </ul>
  );
}

/** Peso para ordenar: crítica primeiro, depois atenção, depois saudável; empate pelo risco de SLA e fila sem corretor. */
export function branchSeverity(branch: BranchHealth) {
  return (branch.health === "critical" ? 2_000_000 : branch.health === "attention" ? 1_000_000 : 0) + branch.slaRiskLeads * 1000 + branch.unassignedLeads;
}

const ATTENTION_VISIBLE = 4;

/**
 * "Precisa de atenção" (20/11/2026, skill interface-enxuta): no lugar de uma faixa colorida grande por anomalia,
 * uma lista compacta com as críticas primeiro, um verbo por item e "Ignorar" discreto. Mostra 4 e "Ver todas".
 */
function AnomalyAlerts({ branches }: { branches: BranchHealth[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const visible = branches
    .filter((branch) => branch.health !== "healthy" && !dismissed.includes(branch.id))
    .sort((a, b) => branchSeverity(b) - branchSeverity(a));
  if (!visible.length) return null;
  const shown = expanded ? visible : visible.slice(0, ATTENTION_VISIBLE);
  return (
    <section className={page.card} aria-labelledby="noc-atencao">
      <div className={styles.cardHeadRow}>
        <h2 id="noc-atencao" className={page.sectionTitle}>
          Precisa de atenção <span className={page.badge} data-tone={visible.some((branch) => branch.health === "critical") ? "danger" : "warning"}>{visible.length}</span>
        </h2>
      </div>
      <ul className={styles.attentionList}>
        {shown.map((branch) => {
          const critical = branch.health === "critical";
          return (
            <li key={branch.id} className={styles.attentionRow} data-tone={critical ? "danger" : "warning"}>
              <span className={styles.attentionDot} aria-hidden="true" />
              <span className={styles.attentionText}>
                <span className={page.cellTitle}>{branch.name}</span>
                <span className={page.cellSub}>{branch.healthReason}</span>
              </span>
              <Link href="/leads/distribuicao" className={styles.attentionVerb}>Resolver fila <ArrowRight aria-hidden="true" size={14} /></Link>
              <button type="button" className={styles.attentionDismiss} onClick={() => setDismissed((previous) => [...previous, branch.id])} aria-label={`Ignorar o aviso de ${branch.name}`}>Ignorar</button>
            </li>
          );
        })}
      </ul>
      {visible.length > ATTENTION_VISIBLE ? (
        <button type="button" className={styles.attentionMore} onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}>
          {expanded ? "Mostrar menos" : `Ver todas (${visible.length})`}
        </button>
      ) : null}
    </section>
  );
}

function BranchTable({ branches }: { branches: BranchHealth[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [health, setHealth] = useState<"all" | BranchHealth["health"]>("all");
  const needle = query.trim().toLocaleLowerCase("pt-BR");
  // Pior primeiro: quem vigia a operação o dia todo vê a unidade com problema no topo (skill interface-enxuta).
  const rows = branches
    .filter((branch) => (health === "all" || branch.health === health) && (!needle || branch.name.toLocaleLowerCase("pt-BR").includes(needle)))
    .sort((a, b) => branchSeverity(b) - branchSeverity(a));
  const counts = { all: branches.length, critical: 0, attention: 0, healthy: 0 };
  for (const branch of branches) counts[branch.health] += 1;
  const healthTabs = [
    { value: "all" as const, label: "Todas" },
    { value: "critical" as const, label: "Críticas" },
    { value: "attention" as const, label: "Atenção" },
    { value: "healthy" as const, label: "Saudáveis" },
  ];
  const columns: LiteColumn<BranchHealth>[] = [
    {
      id: "name",
      label: "Unidade",
      primary: true,
      render: (branch) => (
        <span>
          <span className={page.cellTitle}>{branch.name}</span>
          <span className={page.cellSub}>{branch.acceptingLeads ? "Recebendo leads" : "Recebimento pausado"}</span>
        </span>
      ),
    },
    {
      id: "health",
      label: "Saúde operacional",
      secondary: true,
      render: (branch) => (
        <span className={styles.healthCell}>
          <span className={page.badge} data-tone={HEALTH[branch.health].tone}>{HEALTH[branch.health].label}</span>
          <span className={page.cellSub}>{branch.healthReason}</span>
        </span>
      ),
    },
    { id: "today", label: "Leads hoje", numeric: true, render: (branch) => branch.leadsToday.toLocaleString("pt-BR") },
    { id: "active", label: "Em atendimento", numeric: true, render: (branch) => branch.activeAttendances.toLocaleString("pt-BR") },
    { id: "unassigned", label: "Fila sem corretor", numeric: true, render: (branch) => <span className={styles.value} data-tone={branch.unassignedLeads > 0 ? "warning" : undefined}>{branch.unassignedLeads.toLocaleString("pt-BR")}</span> },
    { id: "sla", label: "Risco de SLA", numeric: true, render: (branch) => <span className={styles.value} data-tone={branch.slaRiskLeads > 0 ? "danger" : undefined}>{branch.slaRiskLeads.toLocaleString("pt-BR")}</span> },
    {
      id: "capacity",
      label: "Corretores disponíveis",
      numeric: true,
      render: (branch) => {
        const capacity = branch.totalBrokers > 0 ? Math.round((branch.availableBrokers / branch.totalBrokers) * 100) : 0;
        return (
          <span className={styles.capacityCell}>
            <span className={styles.value} data-tone={branch.availableBrokers === 0 ? "warning" : undefined}>{branch.availableBrokers}/{branch.totalBrokers}</span>
            <span className={styles.track} role="img" aria-label={`${capacity}% dos corretores disponíveis`}><span className={styles.fill} style={{ width: `${capacity}%` }} /></span>
          </span>
        );
      },
    },
    {
      id: "action",
      label: "Ações",
      numeric: true,
      render: (branch) => (
        <span className={styles.rowActions}>
          <Link href={`/unidades/${branch.id}`} className={page.iconButton} aria-label={`Detalhes da unidade ${branch.name}`} title="Detalhes da unidade" onClick={(event) => event.stopPropagation()}>
            <Info aria-hidden="true" size={18} />
          </Link>
          <Link href={`/leads?branch=${branch.id}`} className={page.iconButton} aria-label={`Ver leads da unidade ${branch.name}`} title="Ver leads">
            <ChevronRight aria-hidden="true" size={18} />
          </Link>
        </span>
      ),
    },
  ];

  return (
    <section className={page.group} aria-labelledby="noc-unidades">
      <div className={page.toolbar}>
        <div className={page.cardHead}>
          <h2 id="noc-unidades" className={page.sectionTitle}>Saúde das unidades</h2>
          <p className={page.muted}>As piores primeiro: risco de SLA, fila sem corretor e corretores disponíveis.</p>
        </div>
        <nav aria-label="Filtrar unidades por saúde" className={styles.healthTabs}>
          {healthTabs.map((tab) => (
            <button key={tab.value} type="button" className={styles.healthTab} data-active={health === tab.value ? "true" : undefined} aria-pressed={health === tab.value} onClick={() => setHealth(tab.value)}>
              {tab.label}<span className={styles.healthCount}>{counts[tab.value]}</span>
            </button>
          ))}
        </nav>
        {branches.length > 1 ? (
          <label className={`${page.search} ${styles.branchSearch}`}>
            <Search aria-hidden="true" size={16} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar unidade no NOC" placeholder="Buscar unidade" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        ) : null}
      </div>
      <LiteResponsiveData
        caption="Saúde das unidades"
        columns={columns}
        rows={rows}
        rowKey={(branch) => branch.id}
        onRowOpen={(branch) => router.push(`/leads?branch=${branch.id}`)}
        empty={<p>Nenhuma unidade nesta aba ou busca.</p>}
      />
    </section>
  );
}

const FEED_PAGE = 8;

export type NocUrgentLead = { id: string; nome: string; reason: string } | null;

export function NocLite({ data, period, now, urgentLead = null }: { data: NocData; period: PeriodValue; now: string; urgentLead?: NocUrgentLead }) {
  const { kpis, leadFlow, statusDistribution, hourlyActivity, teamPerformance, recentActivity, branchHealth, firstContactTrend, ticketTrend } = data;
  const feed = useLitePages(recentActivity, FEED_PAGE);

  const contactDelta = kpis.avgFirstContactSecondsYesterday && kpis.avgFirstContactSeconds ? Math.round(kpis.avgFirstContactSeconds - kpis.avgFirstContactSecondsYesterday) : null;
  const ticketDelta = kpis.avgTicketLastMonth > 0 ? Math.round(((kpis.avgTicketMonth - kpis.avgTicketLastMonth) / kpis.avgTicketLastMonth) * 100) : 0;
  const yesterdayLeads = Math.max(0, kpis.leadsToday - (kpis.leadsTodayVsYesterday >= 0 ? Math.round(kpis.leadsToday / (1 + kpis.leadsTodayVsYesterday / 100)) : kpis.leadsToday));

  const weekLeads = leadFlow.reduce((sum, day) => sum + day.leads, 0);
  const weekConversions = leadFlow.reduce((sum, day) => sum + day.conversoes, 0);
  const statusTotal = statusDistribution.reduce((sum, item) => sum + item.value, 0);
  const statusRows = useMemo(() => [...statusDistribution].sort((a, b) => b.value - a.value), [statusDistribution]);

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <section className={page.toolbar} aria-label="Situação da operação">
        <span className={styles.status}>
          <CircleCheck aria-hidden="true" size={20} className={styles.statusIcon} />
          <span>
            <span className={page.cellTitle}>Todos os sistemas operacionais</span>
            <span className={page.cellSub}>{SERVICES.length} de {SERVICES.length} serviços online</span>
          </span>
        </span>
        <span className={page.badge} data-tone="success"><span className={styles.liveDot} aria-hidden="true" />Ao vivo</span>
        <time className={page.cellSub} dateTime={now}>Atualizado às {updatedAt.format(new Date(now))}</time>
        {urgentLead ? (
          <Link href={`/leads/${urgentLead.id}`} className={`${page.button} ${page.toolbarEnd}`} title={`${urgentLead.nome}: ${urgentLead.reason}`} aria-label={`Próximo lead: ${urgentLead.nome}`}>
            <Zap aria-hidden="true" size={16} />Próximo lead
          </Link>
        ) : null}
        <LiteUrlSelect className={`${page.selectNarrow} ${urgentLead ? "" : page.toolbarEnd}`} label="Período" param="period" value={String(period)} defaultValue={String(DEFAULT_PERIOD)} method="replace" options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
      </section>

      <div className={`${page.stats} ${styles.kpis}`}>
        <StatCard label="Leads hoje" value={kpis.leadsToday} change={formatDelta(kpis.leadsTodayVsYesterday)} trend={kpis.leadsTodayVsYesterday >= 0 ? "up" : "down"} sublabel={`ontem: ${yesterdayLeads} leads`} sparklineData={leadFlow.map((day) => day.leads)} sparklineColor="var(--chart-1)" animated />
        <StatCard label="Em atendimento" value={kpis.activeAttendances} sublabel="leads atendidos agora" sparklineData={leadFlow.map((day) => day.contatos)} sparklineColor="var(--chart-3)" animated animationDelay={0.06} />
        <StatCard label="Taxa de conversão" value={`${kpis.conversionRateMonth}%`} change={formatDelta(kpis.conversionRateMonth - kpis.conversionRateLastMonth, " p.p.")} trend={kpis.conversionRateMonth >= kpis.conversionRateLastMonth ? "up" : "down"} sublabel={`período anterior: ${kpis.conversionRateLastMonth}%`} sparklineData={leadFlow.map((day) => day.conversoes)} sparklineColor="var(--chart-5)" animated animationDelay={0.12} />
        <StatCard label="1º contato (média)" value={formatSeconds(kpis.avgFirstContactSeconds)} change={contactDelta !== null ? formatDelta(-contactDelta, "s") : undefined} trend={contactDelta !== null && contactDelta < 0 ? "up" : contactDelta !== null && contactDelta > 0 ? "down" : "neutral"} sublabel="da criação ao primeiro contato" sparklineData={firstContactTrend} sparklineColor="var(--chart-4)" animated animationDelay={0.18} />
        <StatCard label="Ticket médio" value={formatCurrency(kpis.avgTicketMonth, { maximumFractionDigits: 0 })} change={formatDelta(ticketDelta)} trend={ticketDelta >= 0 ? "up" : "down"} sublabel={`período anterior: ${formatCurrency(kpis.avgTicketLastMonth, { maximumFractionDigits: 0 })}`} sparklineData={ticketTrend} sparklineColor="var(--chart-2)" animated animationDelay={0.24} />
      </div>

      <AnomalyAlerts branches={branchHealth} />
      <BranchTable branches={branchHealth} />

      <div className={styles.charts}>
        <section className={page.card} aria-labelledby="noc-fluxo">
          <div className={styles.cardHeadRow}>
            <div className={page.cardHead}>
              <h2 id="noc-fluxo" className={page.sectionTitle}>Fluxo de leads</h2>
              <p className={page.muted}>Últimos 7 dias: leads, contatos e conversões</p>
            </div>
            <Legend items={[{ label: "Leads", color: "var(--chart-1)" }, { label: "Contatos", color: "var(--chart-3)" }, { label: "Conversões", color: "var(--chart-5)" }]} />
          </div>
          <div className={styles.chart}>
            <ResponsiveContainer height="100%" width="100%" initialDimension={INITIAL_DIMENSION}>
              <AreaChart data={leadFlow} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis axisLine={false} dataKey="dia" tick={AXIS_TICK} tickLine={false} />
                <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
                <Area dataKey="leads" name="Leads" type="monotone" stroke="var(--chart-1)" strokeWidth={2} fill="var(--chart-1)" fillOpacity={0.06} animationDuration={300} />
                <Area dataKey="contatos" name="Contatos" type="monotone" stroke="var(--chart-3)" strokeWidth={2} fill="var(--chart-3)" fillOpacity={0} animationDuration={300} />
                <Area dataKey="conversoes" name="Conversões" type="monotone" stroke="var(--chart-5)" strokeWidth={2} fill="var(--chart-5)" fillOpacity={0} animationDuration={300} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={page.card} aria-labelledby="noc-status">
          <div className={styles.cardHeadRow}>
            <div className={page.cardHead}>
              <h2 id="noc-status" className={page.sectionTitle}>Distribuição por status</h2>
              <p className={page.muted}>Leads por etapa nos últimos 30 dias</p>
            </div>
            <span className={page.badge}>{statusTotal.toLocaleString("pt-BR")} leads</span>
          </div>
          {statusRows.length === 0 ? (
            <p className={page.muted}>Sem dados no período.</p>
          ) : (
            <ul className={styles.bars}>
              {statusRows.map((item) => {
                const share = statusTotal > 0 ? Math.round((item.value / statusTotal) * 100) : 0;
                return (
                  <li key={item.name} className={styles.barRow}>
                    <span className={styles.barLabel}>{item.name.charAt(0) + item.name.slice(1).toLocaleLowerCase("pt-BR")}</span>
                    <span className={styles.track} aria-hidden="true"><span className={styles.fill} style={{ width: `${share}%` }} /></span>
                    <span className={`${page.numeric} ${styles.barValue}`}>{item.value.toLocaleString("pt-BR")} <span className={page.cellSub}>{share}%</span></span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className={styles.triple}>
        <section className={page.card} aria-labelledby="noc-hoje">
          <div className={styles.cardHeadRow}>
            <div className={page.cardHead}>
              <h2 id="noc-hoje" className={page.sectionTitle}>Atividade hoje</h2>
              <p className={page.muted}>Leads recebidos e contatos por hora</p>
            </div>
            <Legend items={[{ label: "Leads", color: "var(--chart-1)" }, { label: "Contatos", color: "var(--chart-3)" }]} />
          </div>
          <div className={styles.chartSmall}>
            <ResponsiveContainer height="100%" width="100%" initialDimension={INITIAL_DIMENSION}>
              <BarChart data={hourlyActivity} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border-subtle)" vertical={false} />
                <XAxis axisLine={false} dataKey="hora" tick={AXIS_TICK} tickLine={false} />
                <YAxis axisLine={false} tick={AXIS_TICK} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--surface-muted)" }} />
                <Bar dataKey="leads" name="Leads" fill="var(--chart-1)" radius={[3, 3, 0, 0]} barSize={10} animationDuration={300} />
                <Bar dataKey="contatos" name="Contatos" fill="var(--chart-3)" radius={[3, 3, 0, 0]} barSize={10} animationDuration={300} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className={page.card} aria-labelledby="noc-equipe">
          <div className={page.cardHead}>
            <h2 id="noc-equipe" className={page.sectionTitle}>Desempenho da equipe</h2>
            <p className={page.muted}>Corretores: conversões sobre leads hoje</p>
          </div>
          {teamPerformance.length === 0 ? (
            <p className={page.muted}>Sem dados de corretores hoje.</p>
          ) : (
            <ul className={styles.bars}>
              {teamPerformance.map((member) => (
                <li key={member.userId} className={styles.teamRow}>
                  <span className={styles.teamHead}>
                    <span className={styles.ellipsis} title={member.nome}>{member.nome}</span>
                    <span className={`${page.numeric} ${page.cellSub}`}>{member.conversoes}/{member.leads} · {member.taxa}%</span>
                  </span>
                  <span className={styles.track} aria-hidden="true"><span className={styles.fill} data-level={member.taxa >= 40 ? "high" : member.taxa >= 20 ? "mid" : "low"} style={{ width: `${member.taxa}%` }} /></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={page.card} aria-labelledby="noc-servicos">
          <div className={page.cardHead}>
            <h2 id="noc-servicos" className={page.sectionTitle}>Status dos serviços</h2>
            <p className={page.muted}>Saúde atual da infraestrutura</p>
          </div>
          <ul className={styles.services}>
            {SERVICES.map((service) => (
              <li key={service.name} className={styles.service}>
                <CircleCheck aria-hidden="true" size={18} className={styles.statusIcon} />
                <span className={styles.serviceName}>{service.name}</span>
                <span className={`${page.cellSub} ${page.numeric}`}>{service.uptime} · {service.latency}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={page.card} aria-labelledby="noc-feed">
        <div className={styles.cardHeadRow}>
          <div className={page.cardHead}>
            <h2 id="noc-feed" className={page.sectionTitle}>Atividades recentes</h2>
            <p className={page.muted}>Movimentações da operação</p>
          </div>
          <span className={page.badge}>Tempo real</span>
        </div>
        {recentActivity.length === 0 ? (
          <p className={page.muted}>Sem atividades recentes.</p>
        ) : (
          <>
            <ul className={styles.feed} aria-label="Atividades recentes">
              {feed.pageRows.map((activity) => (
                <li key={activity.id} className={styles.feedItem} data-type={activity.type}>
                  <span className={styles.feedDot} aria-hidden="true" />
                  <span className={styles.feedText}>
                    <span>{activity.message}</span>
                    <span className={page.cellSub}>
                      {activity.user}
                      {activity.branchName ? ` · ${activity.branchName}` : ""}
                      {" · "}
                      {relativeTime(activity.time, now)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            <LitePagination label="Páginas de atividades" {...feed.pagination} />
          </>
        )}
      </section>

      <div className={page.stats}>
        <div className={page.stat}><span className={page.statLabel}>Leads na semana</span><span className={page.statValue}>{weekLeads.toLocaleString("pt-BR")}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Conversões na semana</span><span className={page.statValue}>{weekConversions.toLocaleString("pt-BR")}</span></div>
        <div className={page.stat}><span className={page.statLabel}>Taxa de conversão semanal</span><span className={page.statValue}>{weekLeads > 0 ? Math.round((weekConversions / weekLeads) * 100) : 0}%</span></div>
        <div className={page.stat}><span className={page.statLabel}>Serviços operacionais</span><span className={page.statValue}>{SERVICES.length}/{SERVICES.length}</span></div>
      </div>
    </div>
  );
}
