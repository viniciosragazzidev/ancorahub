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
import { LiteFilterChips, LiteSelect, useLitePhone } from "@/components/lite/controls";

import { DEFAULT_PERIOD, PERIOD_OPTIONS } from "@/shared/period";

import styles from "./leads-lite-filters.module.css";
import { useLeadFilters, type LeadsFiltersProps } from "./use-lead-filters";

/** As mesmas etapas rápidas de hoje, na mesma ordem. */
const STATUS_PILLS = [
  { id: "", label: "Todos os leads" },
  { id: "new", label: "Novos" },
  { id: "in_contact", label: "Em atendimento" },
  { id: "quote_sent", label: "Cotação enviada" },
  { id: "negotiation", label: "Em negociação" },
  { id: "converted", label: "Convertidos" },
  { id: "lost", label: "Perdidos" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "new", label: "Novos" },
  { value: "distributed", label: "Distribuídos" },
  { value: "in_contact", label: "Em atendimento" },
  { value: "quote_sent", label: "Cotação enviada" },
  { value: "negotiation", label: "Negociação" },
  { value: "documentation_pending", label: "Documento pendente" },
  { value: "under_analysis", label: "Em análise" },
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
  const showQueues = Boolean(queueTabs && queueTabs.tabs.length > 2);
  const panelWrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelTitleId = useId();

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

  const panelFields = (
    <div className={styles.fields}>
      <Segmented label="Tipo de lead" options={TIPO_OPTIONS} value={filters.tipo} onChange={filters.setTipo} />
      {hideOriginFilters ? null : (
        <Segmented label="Origem da oportunidade" options={ORIGEM_OPTIONS} value={filters.origem} onChange={filters.setOrigem} />
      )}
      {tags.length ? (
        <LiteSelect
          label="Tag"
          inline={phone}
          value={filters.tag}
          onChange={(value) => filters.setTag(value ?? "")}
          options={[{ value: "", label: "Todas as tags" }, ...tags.map((item) => ({ value: item.id, label: item.name }))]}
        />
      ) : null}
      {hideOriginFilters ? null : (
        <LiteSelect
          label="Campanhas Meta"
          inline={phone}
          value={filters.eligibleCampaigns ? "1" : ""}
          onChange={(value) => filters.setEligibleCampaigns(value === "1")}
          options={CAMPAIGN_OPTIONS}
        />
      )}
      <LiteSelect label="Etapa" inline={phone} value={status} onChange={filters.setStatus} options={STATUS_OPTIONS} />
      <LiteSelect label="Qualificação" inline={phone} value={filters.qualification} onChange={filters.setQualification} options={QUALIFICATION_OPTIONS} />
      {branches.length > 0 ? (
        <LiteSelect
          label="Filial"
          inline={phone}
          value={filters.branch}
          onChange={filters.setBranch}
          options={[{ value: "", label: "Todas as filiais" }, ...branches.map((item) => ({ value: item.id, label: item.name }))]}
        />
      ) : null}
      {brokers.length > 0 ? (
        <LiteSelect
          label="Corretor"
          inline={phone}
          value={filters.corretor}
          onChange={filters.setCorretor}
          options={[{ value: "", label: "Todos os corretores" }, ...brokers.map((item) => ({ value: item.id, label: item.name }))]}
        />
      ) : null}
      <Segmented label="Itens por página" options={PAGE_SIZES.map((size) => ({ label: size, val: size }))} value={filters.pageSize} onChange={filters.setPageSize} />
    </div>
  );

  const panelFooter = (
    <div className={styles.panelFooter}>
      <button type="button" className={styles.ghostButton} onClick={handleReset}>Limpar</button>
      <button type="button" className={styles.primaryButton} onClick={() => applyFilters()}>Aplicar filtros</button>
    </div>
  );

  return (
    <div className={`arc-venancor ${styles.root}`} data-skin="diretor">
      <div className={styles.toolbar}>
        <form
          role="search"
          className={styles.search}
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <Search aria-hidden="true" size={18} className={styles.searchIcon} />
          <input
            type="search"
            enterKeyHint="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={phone ? "Buscar lead" : "Buscar por nome ou telefone"}
            aria-label="Buscar"
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchSubmit}>Buscar</button>
        </form>
        <div ref={panelWrapRef} className={styles.panelWrap}>
          <button
            ref={triggerRef}
            type="button"
            className={styles.filtersButton}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={activeCount > 0 ? `Filtros, ${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}` : "Filtros"}
            onClick={() => setOpen(!open)}
          >
            <SlidersHorizontal aria-hidden="true" size={16} />
            {/* No celular fica só o ícone e a contagem, para a busca caber na mesma linha. */}
            <span className={styles.filtersLabel}>Filtros</span>
            {activeCount > 0 ? <span className={styles.countBadge} aria-hidden="true">{activeCount}</span> : null}
          </button>
          {open && !phone ? (
            <div role="dialog" aria-labelledby={panelTitleId} className={styles.popover}>
              <div className={styles.panelHead}>
                <h3 id={panelTitleId} className={styles.panelTitle}>Filtros da fila</h3>
                <p className={styles.panelHint}>{activeCount > 0 ? `${activeCount} ${activeCount === 1 ? "ativo" : "ativos"}` : "Refine o kanban e a lista"}</p>
              </div>
              {panelFields}
              {panelFooter}
            </div>
          ) : null}
        </div>
        <div className={styles.selects}>
          <div className={styles.selectStage}>
            <LiteSelect
              label="Etapa"
              hideLabel
              value={optimisticStatus ?? status}
              onChange={selectStatusPill}
              options={STATUS_PILLS.map((pill) => ({ value: pill.id, label: pill.id ? pill.label : "Todas as etapas" }))}
            />
          </div>
          {showQueues && queueTabs ? (
            <div className={styles.selectQueue}>
              <LiteSelect
                label="Fila"
                hideLabel
                value={queueTabs.current}
                onChange={selectQueue}
                options={queueTabs.tabs.map((tab) => ({ value: tab.value, label: tab.value ? tab.label : "Todas as filas", count: tab.count }))}
              />
            </div>
          ) : null}
          {period !== undefined ? (
            <div className={styles.selectPeriod}>
              <LiteSelect
                label="Período"
                hideLabel
                value={String(period)}
                onChange={selectPeriod}
                options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))}
              />
            </div>
          ) : null}
        </div>
        {hasAnyFilter ? (
          <button type="button" className={styles.ghostButton} onClick={handleReset}>
            <span className={styles.longLabel}>Limpar tudo</span>
            <span className={styles.shortLabel}>Limpar</span>
          </button>
        ) : null}
        {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
      </div>

      {phone ? (
        <BottomSheet open={open} onOpenChange={setOpen} title="Filtros da fila" description="Refine o kanban e a lista" closeLabel="Fechar" detents={[0.92]}>
          <div className={styles.sheetBody}>
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

/** Escolha entre poucas opções (tipo, origem, itens por página): pílulas de 44px em alternância (aria-pressed). */
function Segmented({ label, options, value, onChange }: { label: string; options: { label: string; val: string }[]; value: string; onChange: (value: string) => void }) {
  const labelId = useId();
  return (
    <div className={styles.segmentedField}>
      <span id={labelId} className={styles.fieldLabel}>{label}</span>
      <div role="group" aria-labelledby={labelId} className={styles.segmented}>
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={value === option.val}
            className={styles.segment}
            onClick={() => onChange(option.val)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
