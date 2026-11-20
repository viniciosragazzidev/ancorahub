"use client";

/**
 * Resumo do dia da Distribuição para todos os cargos fora do modo corretor (refino 14/11/2026, no mesmo desenho do Desempenho do Lite):
 * título com o período e o menu de exportação, seis números em cartões brancos com ícone, o banner do capitão
 * entre os números e a tabela, e a tabela dos corretores paginada de 10 em 10 (no celular, cartões).
 * A lógica (período, unidade, busca, exportação) é a mesma do painel clássico: `useBrokerDailySummary`.
 */
import "@/components/arc/venancor-scope.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BadgeCheck, CircleSlash, Headset, Inbox, Search, TrendingUp, Users } from "lucide-react";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { AvailabilityToggle } from "@/components/availability-toggle";
import { LiteMenu } from "@/components/lite/controls/menu";
import { LiteSelect } from "@/components/lite/controls/select";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import page from "@/components/lite/page/lite-page.module.css";
import type { BrokerDailySummaryAggregate, BrokerDailySummaryItem } from "@/features/lead-distribution/broker-summary-service";

import { useBrokerDailySummary, type SummaryPeriod } from "./broker-daily-summary-panel";
import styles from "./director-daily-summary.module.css";

const PAGE_SIZE = 10;

const PERIOD_OPTIONS = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "custom", label: "Escolher datas" },
];

type StatusTab = "all" | "available" | "paused" | "offline" | "pending";

/** Grupo de disponibilidade para as abas: pausa junta "paused" e "break"; o resto que não é disponível conta como offline. */
export function availabilityGroup(status: string): "available" | "paused" | "offline" {
  if (status === "available" || status === "busy") return "available";
  if (status === "paused" || status === "break") return "paused";
  return "offline";
}

/** Quem tem lead sem 1º contato vem primeiro (é quem o gestor cobra); empate por mais recebidos. */
export function sortBrokersForFollowUp(items: BrokerDailySummaryItem[]) {
  return [...items].sort((a, b) => b.unstartedLeads - a.unstartedLeads || b.leadsReceived - a.leadsReceived);
}

const STATUS_LABEL: Record<string, string> = { available: "Disponível", busy: "Em atendimento", break: "Pausa", paused: "Pausa" };

function Metric({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint: string; tone?: "success" | "warning" | "danger" }) {
  return (
    <div className={styles.card} data-tone={tone}>
      <dt className={styles.cardTop}><span className={styles.cardIcon} aria-hidden="true">{icon}</span><span className={styles.cardLabel}>{label}</span></dt>
      <dd className={styles.cardValue}>{value}</dd>
      <dd className={styles.cardHint}>{hint}</dd>
    </div>
  );
}

/** Aviso compacto (20/11, skill interface-enxuta): só aparece quando há o que fazer, com um verbo. */
function PendingNotice({ data }: { data: BrokerDailySummaryAggregate }) {
  if (data.totalUnstarted <= 0) return null;
  return (
    <p className={styles.notice} role="status">
      <span className={styles.noticeDot} aria-hidden="true" />
      <span><strong>{data.totalUnstarted}</strong> {data.totalUnstarted === 1 ? "lead sem 1º contato" : "leads sem 1º contato"} no período</span>
      <Link href="/leads" className={styles.noticeVerb}>Ver os leads <ArrowRight aria-hidden="true" size={14} /></Link>
    </p>
  );
}

export function DirectorDailySummary({ initialData, branches, canFilterBranch = true }: {
  initialData: BrokerDailySummaryAggregate;
  branches: { id: string; name: string }[];
  canFilterBranch?: boolean;
}) {
  const router = useRouter();
  const summary = useBrokerDailySummary(initialData);
  const { data, period, filteredItems, isLoading } = summary;
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const counts = useMemo(() => {
    const next = { all: filteredItems.length, available: 0, paused: 0, offline: 0, pending: 0 };
    for (const item of filteredItems) {
      next[availabilityGroup(item.availabilityStatus)] += 1;
      if (item.unstartedLeads > 0) next.pending += 1;
    }
    return next;
  }, [filteredItems]);
  const rows = useMemo(() => sortBrokersForFollowUp(filteredItems.filter((item) => statusTab === "all"
    || (statusTab === "pending" ? item.unstartedLeads > 0 : availabilityGroup(item.availabilityStatus) === statusTab))), [filteredItems, statusTab]);
  const { pageRows, pagination, reset } = useLitePages(rows, PAGE_SIZE);
  const statusTabs: { value: StatusTab; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Com lead sem contato" },
    { value: "available", label: "Disponíveis" },
    { value: "paused", label: "Em pausa" },
    { value: "offline", label: "Offline" },
  ];

  const columns: LiteColumn<BrokerDailySummaryItem>[] = [
    { id: "broker", label: "Corretor", primary: true, render: (item) => <span className={styles.who}><span className={styles.whoName}>{item.brokerName}</span><span className={styles.whoSub}>{item.branchName || "Matriz"}</span></span> },
    { id: "status", label: "Status", render: (item) => canFilterBranch
      ? <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><AvailabilityToggle initialStatus={item.availabilityStatus as "available" | "paused" | "offline"} /></span>
      : <span className={page.badge} data-tone={item.availabilityStatus === "available" ? "success" : item.availabilityStatus === "busy" ? "warning" : undefined}>{STATUS_LABEL[item.availabilityStatus] ?? "Offline"}</span> },
    { id: "received", label: "Recebidos", numeric: true, render: (item) => <strong className={styles.strong}>{item.leadsReceived}</strong> },
    { id: "unstarted", label: "Sem contato", numeric: true, render: (item) => item.unstartedLeads > 0 ? <span className={styles.warn}>{item.unstartedLeads}</span> : "–" },
    { id: "sales", label: "Vendas", numeric: true, render: (item) => <strong className={styles.strong}>{item.convertedLeads}</strong> },
    { id: "conversion", label: "Conversão", numeric: true, render: (item) => `${item.conversionRate}%` },
    { id: "active", label: "Em atendimento", numeric: true, phonePriority: "low", render: (item) => item.activeAttending },
    { id: "response", label: "Tempo de resposta", numeric: true, phonePriority: "low", render: (item) => item.avgFirstContactMinutes !== null ? `${item.avgFirstContactMinutes} min` : "–" },
    { id: "lost", label: "Perdidos", numeric: true, phonePriority: "low", render: (item) => item.lostLeads },
    { id: "redistribution", label: "Redistribuição", numeric: true, phonePriority: "low", render: (item) => <>{item.redistributionRate}% <span className={styles.muted}>({item.redistributedLeads})</span></> },
  ];

  const response = data.avgTeamResponseMinutes !== null ? `~${data.avgTeamResponseMinutes} min de resposta` : "sem tempo de resposta";

  return (
    <div className={`arc-venancor ${styles.root}`} data-art="wide" aria-busy={isLoading}>
      <header className={styles.head}>
        <div className={styles.headText}>
          <h2 className={styles.title}>Resumo dos corretores</h2>
          <p className={styles.lead}>Leads recebidos, atendimento, perdas e conversão de cada corretor no período.</p>
        </div>
        <LiteMenu label="Exportar" items={[
          { id: "csv", label: "Exportar CSV", onSelect: summary.handleExportCSV },
          { id: "pdf", label: summary.isExportingPdf ? "Gerando PDF…" : "Exportar PDF", onSelect: summary.handleExportPDF, disabled: summary.isExportingPdf },
        ]} />
      </header>

      <SegmentedControl label="Período" options={PERIOD_OPTIONS} value={period}
        onValueChange={(value) => { reset(); summary.handlePeriodChange(value as SummaryPeriod); }} className={styles.period} />

      {period === "custom" ? (
        <div className={styles.range}>
          <label className={styles.field}><span>De</span><input type="date" value={summary.startDate} onChange={(event) => summary.setStartDate(event.target.value)} /></label>
          <label className={styles.field}><span>Até</span><input type="date" value={summary.endDate} onChange={(event) => summary.setEndDate(event.target.value)} /></label>
          <button type="button" className={styles.apply} onClick={() => { reset(); summary.handleCustomDateSubmit(); }} disabled={isLoading}>Aplicar</button>
        </div>
      ) : null}

      <dl className={styles.cards}>
        <Metric icon={<Users size={16} />} label="Corretores ativos" value={data.totalBrokers} hint="no período" />
        <Metric icon={<Inbox size={16} />} label="Leads recebidos" value={data.totalReceived} hint="no período" />
        <Metric icon={<Headset size={16} />} label="Em atendimento" value={data.totalActive} tone={data.totalUnstarted > 0 ? "warning" : undefined}
          hint={data.totalUnstarted > 0 ? `${data.totalUnstarted} sem 1º contato` : "todos com 1º contato"} />
        <Metric icon={<CircleSlash size={16} />} label="Leads perdidos" value={data.totalLost} hint="no período" tone="danger" />
        <Metric icon={<BadgeCheck size={16} />} label="Vendas" value={data.totalConverted} hint="no período" tone="success" />
        <Metric icon={<TrendingUp size={16} />} label="Conversão" value={`${data.teamConversionRate}%`} hint={response} />
      </dl>

      <PendingNotice data={data} />

      <section className={styles.list} aria-label="Corretores">
        <div className={styles.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" value={summary.searchQuery} onChange={(event) => { reset(); summary.setSearchQuery(event.target.value); }}
              placeholder="Buscar corretor, e-mail ou unidade" aria-label="Buscar corretor" className={page.searchInput} />
          </label>
          {canFilterBranch ? (
            <div className={styles.branch}>
              <LiteSelect label="Unidade" hideLabel value={summary.selectedBranchId}
                options={[{ value: "all", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]}
                onChange={(value) => { reset(); summary.handleBranchChange(value); }} />
            </div>
          ) : null}
        </div>
        <nav className={styles.statusTabs} aria-label="Filtrar corretores por status">
          {statusTabs.map((tab) => (
            <button key={tab.value} type="button" className={styles.statusTab} data-active={statusTab === tab.value ? "true" : undefined}
              aria-pressed={statusTab === tab.value} onClick={() => { reset(); setStatusTab(tab.value); }}>
              {tab.label}<span className={styles.statusCount}>{counts[tab.value]}</span>
            </button>
          ))}
        </nav>
        <LiteResponsiveData caption="Resumo dos corretores" columns={columns} rows={pageRows} rowKey={(item) => item.brokerId}
          onRowOpen={(item) => router.push(`/leads?corretor=${item.brokerId}`)}
          empty={<p className={styles.empty}>Nenhum corretor encontrado com esses filtros.</p>} />
        <LitePagination {...pagination} label="Páginas dos corretores" pending={isLoading} itemNoun="corretores" />
      </section>
    </div>
  );
}
