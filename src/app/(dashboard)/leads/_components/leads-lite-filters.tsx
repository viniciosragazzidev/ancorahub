"use client";

/**
 * Filtros de /leads no visual Lite (chave do diretor ligada). Mesmo estado, mesmos parâmetros da URL e mesma memória
 * do localStorage da tela atual (`useLeadFilters`); só muda o visual:
 * busca de 44px, botão "Filtros" que abre o painel (popover no desktop, BottomSheet no celular) com `LiteSelect` com
 * busca para cada seleção; etapa, fila e período como seletores na mesma barra; e os filtros ativos como chips
 * removíveis.
 * Como hoje, o painel só vale ao tocar em "Aplicar filtros"; etapas rápidas e remoção de chip aplicam na hora.
 */
import { useEffect, useId, useRef, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";
import { LiteFilterChips, useLitePhone } from "@/components/lite/controls";

import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "@/shared/period";

import styles from "./leads-lite-filters.module.css";
import a1 from "../leads-1a1.module.css";
import { useLeadFilters, type LeadsFiltersProps } from "./use-lead-filters";

/** As mesmas etapas rápidas de hoje, na mesma ordem. */
const STATUS_PILLS = [
  { id: "", label: "Todos os leads" },
  { id: "new", label: "Novos" },
  { id: "in_contact", label: "Em atendimento" },
  { id: "contacted", label: "Entrei em contato" },
  { id: "quote_sent", label: "Cotação enviada" },
  { id: "negotiation", label: "Em negociação" },
  { id: "closing", label: "Fechamento" },
  { id: "converted", label: "Convertidos" },
  { id: "lost", label: "Perdidos" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "new", label: "Novos" },
  { value: "distributed", label: "Distribuídos" },
  { value: "in_contact", label: "Em atendimento" },
  { value: "contacted", label: "Entrei em contato" },
  { value: "quote_sent", label: "Cotação enviada" },
  { value: "negotiation", label: "Negociação" },
  { value: "documentation_pending", label: "Documento pendente" },
  { value: "under_analysis", label: "Em análise" },
  { value: "awaiting_reply", label: "Aguardando retorno" },
  { value: "closing", label: "Fechamento (documento pendente e em análise)" },
  { value: "converted", label: "Convertidos" },
  { value: "lost", label: "Perdidos" },
];

const QUALIFICATION_OPTIONS = [
  { value: "", label: "Todas as qualificações" },
  { value: "unqualified", label: "Sem qualificação" },
  { value: "warm", label: "Morna (em qualificação)" },
  { value: "hot", label: "Quente (alta prioridade)" },
  { value: "disqualified", label: "Desqualificado" },
];

const CAMPAIGN_OPTIONS = [
  { value: "", label: "Todas as campanhas" },
  { value: "1", label: "Somente elegíveis agora" },
];

const TIPO_OPTIONS = [
  { label: "Todos", val: "" },
  { label: "PF", val: "PF" },
  { label: "PJ", val: "PJ" },
];

const ORIGEM_OPTIONS = [
  { label: "Todas", val: "" },
  { label: "Manual", val: "manual" },
  { label: "Webhook", val: "webhook" },
];

const PAGE_SIZES = ["10", "20", "50", "100"];

export function LeadsLiteFilters(props: LeadsFiltersProps) {
  const { hideOriginFilters = false, branches, brokers, tags = [], trailing, queueTabs, period } = props;
  const filters = useLeadFilters(props);
  const {
    open, setOpen, search, setSearch, status, optimisticStatus, activeCount, hasAnyFilter,
    applyFilters, handleReset, chips, handleRemoveChip, selectStatusPill,
  } = filters;
  const phone = useLitePhone();
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const [, startNavigation] = useTransition();
  // Fila: a mesma troca das abas de fila de hoje (?fila=, volta para a página 1, push).
  const selectQueue = (value: string) => {
    const next = new URLSearchParams(urlParams.toString());
    if (value) next.set("fila", value);
    else next.delete("fila");
    next.delete("page");
    startNavigation(() => router.push(next.size ? `${pathname}?${next}` : (pathname ?? "/leads"), { scroll: false }));
  };
  // Período: a mesma troca do seletor de período do topo de hoje (?period=, replace, sem o padrão na URL).
  const selectPeriod = (value: string) => {
    const next = new URLSearchParams(urlParams.toString());
    if (Number(value) === DEFAULT_PERIOD) next.delete("period");
    else next.set("period", value);
    startNavigation(() => router.replace(`${pathname ?? "/leads"}${next.toString() ? `?${next.toString()}` : ""}`, { scroll: false }));
  };
  // Com tarefa atrasada (?tarefa=atrasada): liga e desliga na hora, como a fila; "Limpar tudo" também tira.
  const overdueOnly = urlParams.get("tarefa") === "atrasada";
  const toggleOverdue = () => {
    const next = new URLSearchParams(urlParams.toString());
    if (overdueOnly) next.delete("tarefa");
    else next.set("tarefa", "atrasada");
    next.delete("page");
    startNavigation(() => router.push(next.size ? `${pathname}?${next}` : (pathname ?? "/leads"), { scroll: false }));
  };
  const showQueues = Boolean(queueTabs && queueTabs.tabs.length > 2);
  const panelWrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelTitleId = useId();

  // Atalho do dia a dia (skill interface-enxuta): "/" foca a busca de qualquer ponto da tela, fora de campos de texto.
  useEffect(() => {
    const onSlash = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      event.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onSlash);
    return () => window.removeEventListener("keydown", onSlash);
  }, []);

  // Popover do desktop: Esc e clique fora fecham, como o popover de hoje; o foco volta ao botão "Filtros".
  useEffect(() => {
    if (!open || phone) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (panelWrapRef.current && !panelWrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, phone, setOpen]);

  // Campos do painel no desenho 1:1 do artifact (27/11/2026): rótulo pequeno em cima e seletor em pílula, em duas
  // colunas. Mesmos estados e opções de hoje; só valem ao tocar em "Aplicar filtros".
  const panelFields = (
    <div className={a1.filterGrid}>
      <PillSelect label="Tipo de lead" value={filters.tipo} onChange={filters.setTipo} options={TIPO_OPTIONS.map((option) => ({ value: option.val, label: option.label }))} />
      {hideOriginFilters ? null : (
        <PillSelect label="Origem da oportunidade" value={filters.origem} onChange={filters.setOrigem} options={ORIGEM_OPTIONS.map((option) => ({ value: option.val, label: option.label }))} />
      )}
      {tags.length ? (
        <PillSelect label="Tag" value={filters.tag} onChange={(value) => filters.setTag(value)} options={[{ value: "", label: "Todas as tags" }, ...tags.map((item) => ({ value: item.id, label: item.name }))]} />
      ) : null}
      {hideOriginFilters ? null : (
        <PillSelect label="Campanhas Meta" value={filters.eligibleCampaigns ? "1" : ""} onChange={(value) => filters.setEligibleCampaigns(value === "1")} options={CAMPAIGN_OPTIONS} />
      )}
      <PillSelect label="Etapa" value={status} onChange={filters.setStatus} options={STATUS_OPTIONS} />
      <PillSelect label="Qualificação" value={filters.qualification} onChange={filters.setQualification} options={QUALIFICATION_OPTIONS} />
      {branches.length > 0 ? (
        <PillSelect label="Filial" value={filters.branch} onChange={filters.setBranch} options={[{ value: "", label: "Todas as filiais" }, ...branches.map((item) => ({ value: item.id, label: item.name }))]} />
      ) : null}
      {brokers.length > 0 ? (
        <PillSelect label="Corretor" value={filters.corretor} onChange={filters.setCorretor} options={[{ value: "", label: "Todos os corretores" }, ...brokers.map((item) => ({ value: item.id, label: item.name }))]} />
      ) : null}
      <PillSelect label="Itens por página" value={filters.pageSize} onChange={filters.setPageSize} options={PAGE_SIZES.map((size) => ({ value: size, label: size }))} />
    </div>
  );
  const panelFooter = (
    <div className={a1.filterFoot}>
      <button type="button" className={`${a1.pill} ${a1.pillQuiet} ${a1.pillFlat}`} onClick={handleReset}>Limpar</button>
      <button type="button" className={`${a1.pill} ${a1.pillPrimary}`} onClick={() => applyFilters()}>Aplicar filtros</button>
    </div>
  );

  return (
    <div className={`arc-venancor ${a1.gx} ${styles.root}`} data-skin="diretor">
      <div className={a1.filterRow}>
        <form
          role="search"
          className={a1.search}
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Search aria-hidden="true" />
          <input
            type="search"
            enterKeyHint="search"
            value={search}
            ref={searchRef}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={phone ? "Buscar lead" : "Buscar por nome ou telefone"}
            aria-label="Buscar"
            aria-keyshortcuts="/"
          />
          {phone ? null : <kbd className={a1.kbd} aria-hidden="true" title="Atalho: / foca a busca">/</kbd>}
          <button type="submit" className={a1.srOnly}>Buscar</button>
        </form>
        <div ref={panelWrapRef} className={styles.panelWrap}>
          <button
            ref={triggerRef}
            type="button"
            className={phone ? `${a1.iconbtn} ${a1.filterIconBtn}` : a1.select}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={activeCount > 0 ? `Filtros, ${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}` : "Filtros"}
            onClick={() => setOpen(!open)}
          >
            <SlidersHorizontal aria-hidden="true" />
            {/* No celular fica só o ícone e a contagem, para a busca caber na mesma linha. */}
            {phone ? null : <span className={styles.filtersLabel}>Filtros</span>}
            {activeCount > 0 ? <span className={phone ? a1.filterBadge : a1.filterCount} aria-hidden="true">{activeCount}</span> : null}
          </button>
          {open && !phone ? (
            <div role="dialog" aria-labelledby={panelTitleId} className={`${a1.menu} ${a1.filterPanel}`}>
              <div className={styles.panelHead}>
                <h3 id={panelTitleId} className={a1.filterPanelTitle}>Filtros da fila</h3>
                <p className={a1.filterPanelHint}>{activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}` : "Refine o kanban e a lista"}</p>
              </div>
              {panelFields}
              {panelFooter}
            </div>
          ) : null}
        </div>
        {/* Celular (Celular.dc.html): só a busca e o botão redondo de filtros na linha; etapa, fila, período e
            tarefa atrasada ficam na folha de filtros. */}
        {phone ? null : (
        <>
        <PillSelect
          label="Etapa"
          bare
          value={optimisticStatus ?? status}
          onChange={selectStatusPill}
          options={STATUS_PILLS.map((pill) => ({ value: pill.id, label: pill.id ? pill.label : "Todas as etapas" }))}
        />
        {showQueues && queueTabs ? (
          <PillSelect
            label="Fila"
            bare
            value={queueTabs.current}
            onChange={selectQueue}
            options={queueTabs.tabs.map((tab) => ({ value: tab.value, label: tab.value ? `${tab.label}${typeof tab.count === "number" ? ` (${tab.count.toLocaleString("pt-BR")})` : ""}` : "Todas as filas" }))}
          />
        ) : null}
        {period !== undefined ? (
          <PillSelect label="Período" bare value={String(period)} onChange={selectPeriod} options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
        ) : null}
        <button type="button" className={a1.toggle} aria-pressed={overdueOnly} onClick={toggleOverdue}>
          Com tarefa atrasada
        </button>
        </>
        )}
        {hasAnyFilter || overdueOnly ? (
          <button type="button" className={a1.clearAll} onClick={handleReset}>Limpar tudo</button>
        ) : null}
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>

      {phone ? (
        <BottomSheet open={open} onOpenChange={setOpen} title="Filtros da fila" description="Refine o kanban e a lista" closeLabel="Fechar" detents={[0.92]}>
          <div className={styles.sheetBody}>
            {/* Os seletores da barra do computador: valem na hora, como lá. */}
            <div className={a1.filterGrid}>
              {showQueues && queueTabs ? (
                <PillSelect
                  label="Fila"
                  value={queueTabs.current}
                  onChange={selectQueue}
                  options={queueTabs.tabs.map((tab) => ({ value: tab.value, label: tab.value ? `${tab.label}${typeof tab.count === "number" ? ` (${tab.count.toLocaleString("pt-BR")})` : ""}` : "Todas as filas" }))}
                />
              ) : null}
              {period !== undefined ? (
                <PillSelect label="Período" value={String(period)} onChange={selectPeriod} options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
              ) : null}
            </div>
            <button type="button" className={a1.toggle} aria-pressed={overdueOnly} onClick={toggleOverdue}>
              Com tarefa atrasada
            </button>
            {panelFields}
            {panelFooter}
          </div>
        </BottomSheet>
      ) : null}

      {chips.length > 0 ? (
        <LiteFilterChips label="Filtros ativos" chips={chips} onRemove={handleRemoveChip} />
      ) : null}
    </div>
  );
}

/**
 * Seletor em pílula do artifact "Leads da gestão" (27/11/2026): `<select>` nativo com a seta à direita. `bare` é o da
 * barra (sem rótulo à vista, sombra de repouso); sem `bare`, o do painel (rótulo pequeno em cima).
 */
function PillSelect({ label, value, onChange, options, bare = false }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; bare?: boolean }) {
  const select = (
    <span className={a1.selectWrap}>
      <select className={bare ? a1.selectPill : a1.input} aria-label={bare ? label : undefined} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </span>
  );
  if (bare) return select;
  return <label className={a1.field}>{label}{select}</label>;
}
