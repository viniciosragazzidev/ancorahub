"use client";

/**
 * Resumo do dia da Distribuição para todos os cargos fora do modo corretor (refino 14/11/2026, no mesmo desenho do Desempenho do Lite):
 * título com o período e o menu de exportação, seis números em cartões brancos com ícone, o banner do capitão
 * entre os números e a tabela, e a tabela dos corretores paginada de 10 em 10 (no celular, cartões).
 * A lógica (período, unidade, busca, exportação) é a mesma do painel clássico: `useBrokerDailySummary`.
 */
import "@/components/arc/venancor-scope.css";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BadgeCheck, CircleSlash, Clock, Headset, Inbox, Search, TrendingUp, Users } from "lucide-react";

import SegmentedControl from "@/components/arc/segmented-control/segmented-control";
import { AvailabilityToggle } from "@/components/availability-toggle";
import { CaptainBanner, type CaptainBannerArt } from "@/components/lite/banner/captain-banner";
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

/** O capitão no convés, mão no leme, lançando envelopes com a âncora para três marujos (arte de 14/11/2026). */
const DISTRIBUTION_ART: CaptainBannerArt = { src: "/mascote/distribuicao-capitao.webp", width: 800, height: 533 };

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

function SummaryBanner({ data }: { data: BrokerDailySummaryAggregate }) {
  const title = data.totalUnstarted > 0
    ? `${data.totalUnstarted} ${data.totalUnstarted === 1 ? "lead ainda está" : "leads ainda estão"} sem primeiro contato. Bora acionar a tripulação?`
    : data.totalReceived > 0
      ? "Todo lead que chegou já teve primeiro contato. A tripulação está no ritmo!"
      : "Assim que os leads chegarem, a distribuição aparece aqui. Mar calmo por enquanto.";
  const goal = data.totalReceived > 0 ? { value: `${data.teamConversionRate}%`, hint: "de conversão da equipe" } : undefined;
  return (
    <CaptainBanner className={styles.banner} label="Dica da distribuição" tone="white" title={title} goal={goal}
      progress={data.totalReceived > 0 ? data.teamConversionRate : null} art={DISTRIBUTION_ART}
      action={{ label: "Abrir a operação", href: "/distribuicao?view=operar" }} />
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
  const { pageRows, pagination, reset } = useLitePages(filteredItems, PAGE_SIZE);

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

      <SummaryBanner data={data} />

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
        <p className={styles.count}>
          <Clock size={14} aria-hidden="true" /> {filteredItems.length} {filteredItems.length === 1 ? "corretor" : "corretores"} · toque na linha para ver os leads
        </p>
        <LiteResponsiveData caption="Resumo dos corretores" columns={columns} rows={pageRows} rowKey={(item) => item.brokerId}
          onRowOpen={(item) => router.push(`/leads?corretor=${item.brokerId}`)}
          empty={<p className={styles.empty}>Nenhum corretor encontrado com esses filtros.</p>} />
        <LitePagination {...pagination} label="Páginas dos corretores" pending={isLoading} />
      </section>
    </div>
  );
}
