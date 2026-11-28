"use client";

/**
 * "Resumo dos corretores" da Distribuição (27/11/2026), cópia 1:1 do artifact "Distribuição · Resumo".
 * A lógica (período, unidade, busca, exportação) é a mesma do painel anterior: `useBrokerDailySummary`.
 * No celular, os corretores viram cartões (Celular.dc.html).
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { BrokerDailySummaryAggregate, BrokerDailySummaryItem } from "@/features/lead-distribution/broker-summary-service";

import { useBrokerDailySummary, type SummaryPeriod } from "./broker-daily-summary-panel";
import { availabilityGroup, sortBrokersForFollowUp } from "./director-daily-summary";
import { PageButtons, PillSelect, initialsOf } from "./resumo-1a1-parts";
import { PlInfo } from "../plantao/_components/plantoes-1a1-kit";
import s from "./resumo-1a1.module.css";

const PAGE_SIZE = 10;
type StatusTab = "all" | "available" | "paused" | "offline" | "pending";

const PERIODS: { value: SummaryPeriod; label: string; short: string }[] = [
  { value: "today", label: "Hoje", short: "Hoje" },
  { value: "week", label: "Semana", short: "Semana" },
  { value: "month", label: "Mês", short: "Mês" },
  { value: "custom", label: "Escolher datas", short: "Datas" },
];

/** Status do corretor no desenho do artifact: selo com ponto. */
function statusOf(status: string) {
  if (status === "available") return { label: "Disponível", cls: s.bGood, dot: "var(--success)" };
  if (status === "busy") return { label: "Em atendimento", cls: s.bInfo, dot: "var(--d-action)" };
  if (status === "paused" || status === "break") return { label: "Pausa", cls: s.bWarn, dot: "var(--warning)" };
  return { label: "Offline", cls: "", dot: "var(--text-muted)" };
}

export function DirectorDailySummary1a1({ initialData, branches, canFilterBranch = true }: {
  initialData: BrokerDailySummaryAggregate;
  branches: { id: string; name: string }[];
  canFilterBranch?: boolean;
}) {
  const router = useRouter();
  const summary = useBrokerDailySummary(initialData);
  const { data, period, filteredItems, isLoading } = summary;
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [page, setPage] = useState(1);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    const close = (event: PointerEvent) => {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setExportOpen(false); };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [exportOpen]);

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
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const reset = () => setPage(1);
  const open = (item: BrokerDailySummaryItem) => router.push(`/leads?corretor=${item.brokerId}`);

  const chips: { value: StatusTab; label: string }[] = [
    { value: "all", label: "Todos" },
    { value: "pending", label: "Com lead sem contato" },
    { value: "available", label: "Disponíveis" },
    { value: "paused", label: "Em pausa" },
    { value: "offline", label: "Offline" },
  ];
  const response = data.avgTeamResponseMinutes !== null ? `~${data.avgTeamResponseMinutes} min de resposta` : "sem tempo de resposta";
  const stats = [
    { label: "Corretores ativos", value: data.totalBrokers.toLocaleString("pt-BR"), detail: "no período" },
    { label: "Leads recebidos", value: data.totalReceived.toLocaleString("pt-BR"), detail: "no período" },
    { label: "Em atendimento", value: data.totalActive.toLocaleString("pt-BR"),
      detail: data.totalUnstarted > 0 ? `${data.totalUnstarted} sem 1º contato` : "todos com 1º contato", detailCls: data.totalUnstarted > 0 ? s.toneWarning : "" },
    { label: "Leads perdidos", value: data.totalLost.toLocaleString("pt-BR"), detail: "no período", valueCls: s.toneDanger },
    { label: "Vendas", value: data.totalConverted.toLocaleString("pt-BR"), detail: "no período", valueCls: s.toneSuccess },
    { label: "Conversão", value: `${data.teamConversionRate.toLocaleString("pt-BR")}%`, detail: response },
  ];
  const from = rows.length ? (current - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(current * PAGE_SIZE, rows.length);

  return (
    <section className={s.brokers} aria-labelledby="resumo-corretores" aria-busy={isLoading}>
      <div className={s.brokersHead}>
        <div>
          <h2 id="resumo-corretores" className={s.h2}>Resumo dos corretores <PlInfo label="O que é este resumo">Leads recebidos, atendimento, perdas e conversão de cada corretor no período.</PlInfo></h2>
        </div>
        <div className={s.headActions} ref={exportRef}>
          <div className={s.segment} role="group" aria-label="Período">
            {PERIODS.map((option) => (
              <button key={option.value} type="button" className={s.segbtn} aria-pressed={period === option.value}
                onClick={() => { reset(); summary.handlePeriodChange(option.value); }}>
                <span className={s.segLong}>{option.label}</span><span className={s.segShort}>{option.short}</span>
              </button>
            ))}
          </div>
          <span className={s.exportBox}>
            <button type="button" className={`${s.pill} ${s.pillQuiet}`} aria-expanded={exportOpen} aria-haspopup="menu" onClick={() => setExportOpen((value) => !value)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 20h16" /></svg>
              Exportar
            </button>
            {exportOpen ? (
              <div className={`${s.menu} ${s.popover}`} role="menu">
                <button type="button" className={s.menuitem} role="menuitem" onClick={() => { setExportOpen(false); summary.handleExportCSV(); }}>Exportar CSV</button>
                <button type="button" className={s.menuitem} role="menuitem" disabled={summary.isExportingPdf}
                  onClick={() => { setExportOpen(false); void summary.handleExportPDF(); }}>{summary.isExportingPdf ? "Gerando PDF…" : "Exportar PDF"}</button>
              </div>
            ) : null}
          </span>
        </div>
      </div>

      {period === "custom" ? (
        <div className={`${s.card} ${s.range}`}>
          <label className={s.field}>De<input type="date" className={s.num} value={summary.startDate} onChange={(event) => summary.setStartDate(event.target.value)} /></label>
          <label className={s.field}>Até<input type="date" className={s.num} value={summary.endDate} onChange={(event) => summary.setEndDate(event.target.value)} /></label>
          <button type="button" className={`${s.pill} ${s.pillPrimary}`} disabled={isLoading} onClick={() => { reset(); summary.handleCustomDateSubmit(); }}>Aplicar</button>
        </div>
      ) : null}

      <dl className={s.stats}>
        {stats.map((stat, index) => (
          <div key={stat.label} className={`${s.stat} ${s.in}`} style={{ animationDelay: `${120 + index * 40}ms` }}>
            <dt className={s.statLabel}>{stat.label}</dt>
            <dd className={`${s.statValue} ${stat.valueCls ?? ""}`}>{stat.value}</dd>
            <dd className={`${s.statDetail} ${stat.detailCls ?? ""}`}>{stat.detail}</dd>
          </div>
        ))}
      </dl>

      {data.totalUnstarted > 0 ? (
        <div className={`${s.card} ${s.warnCard}`} role="status">
          <span className={s.dot} style={{ background: "var(--warning)" }} aria-hidden="true" />
          <p className={s.warnText}>
            <strong>{data.totalUnstarted} {data.totalUnstarted === 1 ? "lead" : "leads"}</strong> sem 1º contato<span className={s.warnTail}> no período.</span>
          </p>
          <Link href="/leads" className={s.warnLink}><span className={s.warnLinkLong}>Ver os leads</span><span className={s.warnLinkShort}>Ver</span></Link>
        </div>
      ) : null}

      <section className={`${s.card} ${s.listCard} ${s.in}`} aria-label="Corretores" style={{ animationDelay: "200ms" }}>
        <div className={s.toolbar}>
          <label className={s.search}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span className={s.srOnly}>Buscar corretor, e-mail ou unidade</span>
            <input type="search" value={summary.searchQuery} placeholder="Buscar corretor, e-mail ou unidade"
              onChange={(event) => { reset(); summary.setSearchQuery(event.target.value); }} />
          </label>
          {canFilterBranch ? (
            <PillSelect label="Unidade" value={summary.selectedBranchId}
              options={[{ value: "all", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]}
              onChange={(value) => { reset(); summary.handleBranchChange(value); }} />
          ) : null}
        </div>
        <ScrollArea orientation="horizontal" className={s.chipsWrap}>
          <div className={s.chips} role="group" aria-label="Status dos corretores">
            {chips.map((chip) => (
              <button key={chip.value} type="button" className={s.chip} aria-pressed={statusTab === chip.value}
                onClick={() => { reset(); setStatusTab(chip.value); }}>
                {chip.label} <span className={s.chipCount}>{counts[chip.value]}</span>
              </button>
            ))}
          </div>
        </ScrollArea>

        <div className={s.desktopOnly}>
          {pageRows.length ? (
            <ScrollArea orientation="horizontal" className={s.sa}>
              <div role="table" aria-label="Resumo dos corretores">
                <div role="row" className={`${s.brow} ${s.bth}`}>
                  <span role="columnheader">Corretor</span><span role="columnheader">Status</span>
                  <span role="columnheader" className={s.right}>Recebidos</span><span role="columnheader" className={s.right}>Sem contato</span>
                  <span role="columnheader" className={s.right}>Vendas</span><span role="columnheader" className={s.right}>Conversão</span>
                  <span role="columnheader" className={s.right}>Em atendimento</span><span role="columnheader" className={s.right}>Tempo de resposta</span>
                  <span role="columnheader" className={s.right}>Perdidos</span><span role="columnheader" className={s.right}>Redistribuição</span>
                </div>
                {pageRows.map((item) => {
                  const status = statusOf(item.availabilityStatus);
                  return (
                    <div key={item.brokerId} role="row" tabIndex={0} className={s.brow} aria-label={`Ver os leads de ${item.brokerName}`}
                      onClick={() => open(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(item); } }}>
                      <span role="cell" className={s.who}>
                        <span className={s.av} aria-hidden="true">{initialsOf(item.brokerName)}</span>
                        <span className={s.whoText}><span className={s.whoName}>{item.brokerName}</span><span className={s.whoSub}>{item.branchName || "Matriz"}</span></span>
                      </span>
                      <span role="cell"><span className={`${s.badge} ${status.cls}`}><span className={s.badgeDot} style={{ background: status.dot }} aria-hidden="true" />{status.label}</span></span>
                      <span role="cell" className={`${s.num} ${s.right}`}>{item.leadsReceived}</span>
                      <span role="cell" className={`${s.num} ${s.right} ${item.unstartedLeads > 0 ? s.warnNum : s.mutedNum}`}>{item.unstartedLeads}</span>
                      <span role="cell" className={`${s.num} ${s.right}`}>{item.convertedLeads}</span>
                      <span role="cell" className={`${s.num} ${s.right}`}>{item.conversionRate.toLocaleString("pt-BR")}%</span>
                      <span role="cell" className={`${s.num} ${s.right}`}>{item.activeAttending}</span>
                      <span role="cell" className={`${s.num} ${s.right} ${s.secondary}`}>{item.avgFirstContactMinutes !== null ? `${item.avgFirstContactMinutes} min` : "–"}</span>
                      <span role="cell" className={`${s.num} ${s.right}`}>{item.lostLeads}</span>
                      <span role="cell" className={`${s.num} ${s.right} ${s.secondary}`}>{item.redistributionRate.toLocaleString("pt-BR")}% ({item.redistributedLeads})</span>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          ) : <p className={s.empty}>Nenhum corretor encontrado com esses filtros.</p>}
        </div>
        <div className={`${s.tableFoot} ${s.listFoot}`}>
          <span className={s.footNote}>{from} a {to} de {rows.length.toLocaleString("pt-BR")} {rows.length === 1 ? "corretor" : "corretores"} · clique na linha para ver os leads</span>
          <PageButtons page={current} totalPages={totalPages} onPageChange={setPage} label="Páginas de corretores" disabled={isLoading} />
        </div>
      </section>

      <div className={s.mobileOnly}>
        <div className={s.mCards}>
          {pageRows.length ? pageRows.map((item) => {
            const status = statusOf(item.availabilityStatus);
            return (
              <button key={item.brokerId} type="button" className={`${s.card} ${s.mBroker}`} onClick={() => open(item)}>
                <span className={s.mBrokerTop}>
                  <span className={s.mAv} aria-hidden="true">{initialsOf(item.brokerName)}</span>
                  <span className={s.mWho}><span className={s.mName}>{item.brokerName}</span><span className={s.mUnit}>{item.branchName || "Matriz"}</span></span>
                  <span className={`${s.badge} ${status.cls}`}>{status.label}</span>
                </span>
                <span className={s.mNums}>
                  <span><span className={s.mNum}>{item.leadsReceived}</span>recebidos</span>
                  <span><span className={`${s.mNum} ${item.unstartedLeads > 0 ? s.mNumWarn : ""}`}>{item.unstartedLeads}</span>sem contato</span>
                  <span><span className={s.mNum}>{item.convertedLeads}</span>vendas</span>
                  <span><span className={s.mNum}>{item.conversionRate.toLocaleString("pt-BR")}%</span>conversão</span>
                </span>
              </button>
            );
          }) : <p className={s.muted}>Nenhum corretor encontrado com esses filtros.</p>}
          {totalPages > 1 ? <div className={s.mPages}><PageButtons page={current} totalPages={totalPages} onPageChange={setPage} label="Páginas de corretores" /></div> : null}
        </div>
      </div>
    </section>
  );
}
