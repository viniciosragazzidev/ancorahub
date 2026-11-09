"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { ArcScopeProvider } from "@/components/arc/arc-scope-context";
import { Skeleton } from "@/components/arc/skeleton/skeleton";
import { DashboardHeader } from "@/components/dashboard-header";
import { LiteSelect } from "@/components/lite/controls";
import { LiteDataTable } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { LiteSidePanel } from "@/components/lite/data/side-panel";
import { formatLiteDate } from "@/components/lite/format/date";
import { LiteSkeletonToContent, LiteSwap } from "@/components/lite/motion";
import litePage from "@/components/lite/page/lite-page.module.css";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import type { NegotiationLevel } from "./negotiation-model";
import { getNegotiationTimelineAction } from "./actions";
import { createNegotiationLeadColumns, formatNegotiationMetric, LEVEL_LABELS, NegotiationStatsView } from "./negotiations-data-views";
import type { NegotiationLead, NegotiationTimelineEvent, NegotiationsDashboardData } from "./queries";
import { NegotiationStageSummary, type SummaryFilter } from "./negotiation-stage-summary";
import { NegotiationWaitingPanel } from "./negotiation-waiting-panel";
import { NegotiationLeadRow } from "./negotiation-lead-row";
import { NegotiationLeadAi, NegotiationLeadSituation, NegotiationLeadTrail } from "./negotiation-lead-signals";
import { NegotiationClosingNow } from "./negotiation-closing-now";
import { NegotiationClosingOutcomes } from "./negotiation-closing-outcomes";
import type { ClosingOutcomesSummary } from "@/features/leads/closing-outcome-core";
import styles from "./negotiations.module.css";

type Filter = "all" | SummaryFilter;
type PageTab = "negotiations" | "statistics";
/** "team": supervisor e gestor do app Light leem a conversa da equipe; "inbox": a conversa abre na caixa de Conversas. */
export type NegotiationConversationMode = "team" | "inbox";

/** Ordem dos grupos da lista: quem está mais perto de fechar vem primeiro. */
const GROUP_ORDER: NegotiationLevel[] = ["closing", "advanced", "in_conversation", "cooling", "no_crm_conversation"];

export function negotiationConversationHref(leadId: string, mode: NegotiationConversationMode) {
  return mode === "team" ? `/mensagens/${leadId}` : `/conversas?leadId=${encodeURIComponent(leadId)}`;
}

function statusLabel(status: string) {
  return LEAD_STATUS_LABELS[status] ?? status;
}

export function NegotiationsDashboard({ data, activeTab, generatedAt, conversationMode = "inbox", closingOutcomes = null }: { data: NegotiationsDashboardData; activeTab: PageTab; generatedAt: Date; conversationMode?: NegotiationConversationMode; /** Só para o diretor (09/11). */ closingOutcomes?: ClosingOutcomesSummary | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedBranch = searchParams.get("unidade");
  const branchFilter = data.scope.role === "director" && data.scope.branches.some((branch) => branch.id === requestedBranch)
    ? requestedBranch!
    : "all";
  const [activeFilter, setActiveFilter] = useState<Filter>("all");
  const [brokerFilter, setBrokerFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [listPresentation, setListPresentation] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [selectedLead, setSelectedLead] = useState<NegotiationLead | null>(null);
  const [timeline, setTimeline] = useState<NegotiationTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const timelineRequest = useRef(0);
  const [isRefreshing, startRefresh] = useTransition();

  async function loadTimeline(leadId: string) {
    const requestId = ++timelineRequest.current;
    setTimelineLoading(true);
    setTimeline([]);
    setTimelineError(null);
    try {
      const result = await getNegotiationTimelineAction(leadId);
      if (requestId !== timelineRequest.current) return;
      if (result.success) setTimeline(result.events);
      else setTimelineError(result.error);
    } catch {
      if (requestId === timelineRequest.current) setTimelineError("Não foi possível carregar a linha do tempo.");
    } finally {
      if (requestId === timelineRequest.current) setTimelineLoading(false);
    }
  }

  function openLead(lead: NegotiationLead) {
    setSelectedLead(lead);
    void loadTimeline(lead.id);
  }

  function closeLead() {
    timelineRequest.current += 1;
    setSelectedLead(null);
    setTimelineLoading(false);
  }

  const filteredLeads = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    return data.leads.filter((lead) => {
      if (activeFilter !== "all" && activeFilter === "customers_waiting" && !lead.customerWaiting) return false;
      if (activeFilter === "no_reply" && !lead.waiting) return false;
      if (activeFilter !== "all" && activeFilter !== "customers_waiting" && activeFilter !== "no_reply" && lead.level !== activeFilter) return false;
      if (branchFilter !== "all" && lead.branchId !== branchFilter) return false;
      if (brokerFilter !== "all" && lead.brokerId !== brokerFilter) return false;
      if (levelFilter !== "all" && lead.level !== levelFilter) return false;
      if (needle && ![lead.name, lead.brokerName, lead.branchName, lead.ai.summary, lead.ai.nextBestAction].some((value) => value?.toLocaleLowerCase("pt-BR").includes(needle))) return false;
      return true;
    });
  }, [activeFilter, brokerFilter, branchFilter, data.leads, levelFilter, query]);

  const { pageRows, pagination, reset } = useLitePages(filteredLeads, 20);
  const pageFilterKey = `${activeFilter}\u0000${brokerFilter}\u0000${branchFilter}\u0000${levelFilter}\u0000${query}`;
  const previousPageFilter = useRef(pageFilterKey);
  useEffect(() => {
    if (previousPageFilter.current === pageFilterKey) return;
    previousPageFilter.current = pageFilterKey;
    reset();
  }, [pageFilterKey, reset]);

  const columns = useMemo(() => createNegotiationLeadColumns(generatedAt), [generatedAt]);
  const brokerOptions = useMemo(() => [{ value: "all", label: "Todos os corretores" }, ...data.brokers.map((broker) => ({ value: broker.id, label: broker.name }))], [data.brokers]);
  const levelOptions = useMemo(() => [{ value: "all", label: "Todos os níveis" }, ...Object.entries(LEVEL_LABELS).map(([value, label]) => ({ value, label }))], []);
  const branchOptions = useMemo(() => [{ value: "all", label: "Todas as unidades" }, ...data.scope.branches.map((branch) => ({ value: branch.id, label: branch.name }))], [data.scope.branches]);
  const leadHref = selectedLead ? `/leads/${selectedLead.id}` : "/leads";
  const conversationHref = selectedLead ? negotiationConversationHref(selectedLead.id, conversationMode) : "/conversas";
  const groupedRows = useMemo(() => GROUP_ORDER
    .map((level) => ({ level, rows: pageRows.filter((lead) => lead.level === level) }))
    .filter((group) => group.rows.length > 0), [pageRows]);

  function setBranch(value: string) {
    const params = new URLSearchParams();
    if (value !== "all") params.set("unidade", value);
    if (activeTab === "statistics") params.set("aba", "estatisticas");
    const target = params.size ? `/negociacoes?${params.toString()}` : "/negociacoes";
    router.push(target, { scroll: false });
  }

  return (
    <ArcScopeProvider enabled>
      <div className="arc-venancor" data-skin="diretor">
        <DashboardHeader breadcrumb="Equipe" title="Negociações" />
        <main className={`${litePage.stack} ${styles.root}`} aria-label="Negociações da equipe">
          <div className={styles.summaryLine}>
            <p className={styles.summary}>{formatNegotiationMetric(data.leads.length)} atendimentos acompanhados · atualizado às {formatLiteDate(generatedAt, { hour: "2-digit", minute: "2-digit" })}</p>
            {data.scope.role === "director" && branchOptions.length > 1 ? <div className={styles.select}><LiteSelect label="Unidade" hideLabel value={branchFilter} options={branchOptions} onChange={setBranch} /></div> : null}
            <nav className={styles.tabs} aria-label="Visões de negociações">
              <Link href={data.scope.branchId ? `/negociacoes?unidade=${encodeURIComponent(data.scope.branchId)}` : "/negociacoes"} aria-current={activeTab === "negotiations" ? "page" : undefined} className={styles.tab}>Negociações</Link>
              <Link href={data.scope.branchId ? `/negociacoes?aba=estatisticas&unidade=${encodeURIComponent(data.scope.branchId)}` : "/negociacoes?aba=estatisticas"} aria-current={activeTab === "statistics" ? "page" : undefined} className={styles.tab}>Estatísticas</Link>
            </nav>
          </div>

          {data.scope.scopeMessage ? (
            <section className={litePage.empty} role="status">
              <h2 className={litePage.emptyTitle}>Escopo indisponível</h2>
              <p className={litePage.emptyText}>{data.scope.scopeMessage}</p>
            </section>
          ) : activeTab === "statistics" ? (
            <NegotiationStatsView brokerStats={data.brokerStats} dailyStats={data.dailyStats} aiHealth={data.aiHealth} counts={data.counts} />
          ) : (
            <>
              <NegotiationStageSummary
                data={data}
                generatedAt={generatedAt}
                activeFilter={activeFilter}
                onFilter={(filter) => setActiveFilter(activeFilter === filter ? "all" : filter)}
              />
              <NegotiationClosingNow leads={data.leads} generatedAt={generatedAt} onOpen={openLead} onShowAll={() => setActiveFilter("closing")} />
              {closingOutcomes ? <NegotiationClosingOutcomes summary={closingOutcomes} /> : null}
              {activeFilter === "no_reply" && data.customerWaitingGuard ? (
                <NegotiationWaitingPanel rows={data.customerWaitingGuard.rows} onOpen={(row) => router.push(negotiationConversationHref(row.leadId, conversationMode))} />
              ) : (
              <section className={styles.list} aria-label="Lista de negociações">
                <div className={styles.toolbar}>
                  <label className={styles.search}>
                    <Search aria-hidden="true" size={18} className={styles.searchIcon} />
                    <input className={styles.searchInput} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar atendimento" aria-label="Buscar nas negociações" />
                  </label>
                  <div className={styles.select}><LiteSelect label="Corretor" hideLabel value={brokerFilter} options={brokerOptions} onChange={setBrokerFilter} /></div>
                  <div className={styles.select}><LiteSelect label="Nível" hideLabel value={levelFilter} options={levelOptions} onChange={setLevelFilter} /></div>
                  <button type="button" className={litePage.button} disabled={isRefreshing} onClick={() => startRefresh(() => router.refresh())}>{isRefreshing ? "Atualizando" : "Atualizar"}</button>
                  <p className={styles.resultCount} aria-live="polite">{filteredLeads.length} {filteredLeads.length === 1 ? "resultado" : "resultados"}</p>
                </div>
                <div className={styles.presentationControls} role="group" aria-label="Formato da lista">
                  <button type="button" className={styles.presentationButton} aria-pressed={listPresentation === "cards"} onClick={() => setListPresentation("cards")}>Cartões</button>
                  <button type="button" className={styles.presentationButton} aria-pressed={listPresentation === "table"} onClick={() => setListPresentation("table")}>Tabela</button>
                </div>
                <LiteSwap swapKey={listPresentation}>
                  {pageRows.length ? listPresentation === "cards" ? (
                    <div className={styles.leadGroups} data-lite="negotiation-groups">
                      {groupedRows.map((group) => (
                        <section key={group.level} className={styles.leadGroup} aria-labelledby={`negotiation-group-${group.level}`}>
                          <h3 className={styles.groupTitle} id={`negotiation-group-${group.level}`}>
                            <span className={styles.groupDot} data-level={group.level} aria-hidden="true" />
                            {LEVEL_LABELS[group.level]}
                          </h3>
                          <ul className={styles.leadCards} aria-label={`Atendimentos em ${LEVEL_LABELS[group.level]}`} data-lite="negotiation-cards">
                            {group.rows.map((lead, index) => <NegotiationLeadRow key={lead.id} lead={lead} index={index} generatedAt={generatedAt} onOpen={openLead} />)}
                          </ul>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <LiteDataTable
                      caption="Atendimentos ativos por nível de negociação"
                      columns={columns}
                      rows={pageRows}
                      rowKey={(lead) => lead.id}
                      onRowOpen={openLead}
                      empty={<p>Nenhum atendimento neste filtro.</p>}
                    />
                  ) : (
                    <div className={styles.empty}>
                      <h2 className={styles.emptyTitle}>{data.leads.length ? "Nenhum atendimento neste filtro" : "Nenhum atendimento ativo"}</h2>
                      <p className={styles.emptyText}>{data.leads.length ? "Tente outro nível, corretor ou busca." : "Os atendimentos aparecem aqui quando há sinais de conversa ou uma etapa comercial ativa."}</p>
                    </div>
                  )}
                </LiteSwap>
                <LitePagination {...pagination} label="Páginas de negociações" />
              </section>
              )}
            </>
          )}
        </main>

        <LiteSidePanel open={Boolean(selectedLead)} onOpenChange={(open) => { if (!open) closeLead(); }} title={selectedLead?.name ?? "Atendimento"} description={selectedLead ? `${LEVEL_LABELS[selectedLead.level]} · ${statusLabel(selectedLead.status)}` : undefined}>
          {selectedLead ? (
            <div className={styles.drawerStack}>
              <div className={styles.drawerActions}>
                <Link className={litePage.primaryButton} href={conversationHref}>Abrir conversa</Link>
                <Link className={styles.textLink} href={leadHref}>Ver lead</Link>
              </div>
              <NegotiationLeadTrail lead={selectedLead} />
              <NegotiationLeadSituation lead={selectedLead} now={generatedAt} />
              <NegotiationLeadAi lead={selectedLead} now={generatedAt} />

              <section className={styles.drawerSection}>
                <h3 className={styles.drawerTitle}>Linha do tempo</h3>
                <LiteSkeletonToContent loading={timelineLoading} skeleton={<Skeleton label="Carregando linha do tempo" lines={5} />} minHeight={240} className={styles.timelineSkeleton}>
                  {timelineError ? (
                    <div className={styles.loading} role="alert">
                      <p>{timelineError}</p>
                      <button type="button" className={styles.textLink} onClick={() => { if (selectedLead) void loadTimeline(selectedLead.id); }}>Tentar novamente</button>
                    </div>
                  ) : timeline.length ? (
                    <ol className={styles.timeline}>
                      {timeline.map((event) => (
                        <li key={event.id} className={styles.timelineItem}>
                          <p className={styles.timelineLabel}>{event.label}</p>
                          <time className={styles.timelineAt} dateTime={event.at}>{formatLiteDate(event.at, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
                          {event.detail ? <p className={styles.timelineDetail}>{event.detail}</p> : null}
                        </li>
                      ))}
                    </ol>
                  ) : <p className={styles.loading}>Sem eventos registrados para este atendimento.</p>}
                </LiteSkeletonToContent>
              </section>

            </div>
          ) : null}
        </LiteSidePanel>
      </div>
    </ArcScopeProvider>
  );
}
