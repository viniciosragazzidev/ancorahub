"use client";

/**
 * Leads em pós-venda (24/11): todas as pesquisas do período numa tabela Lite, com filtros por situação, origem,
 * corretor, resposta e dia de envio. Clique na linha abre o painel com a conversa. Exporta o que está filtrado.
 */
import { useMemo } from "react";
import { Download, Search } from "lucide-react";

import { LiteFilterChips, LiteSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import { formatLiteDate } from "@/components/lite/format/date";
import page from "@/components/lite/page/lite-page.module.css";
import { postSaleRuleLabel, POST_SALE_RULE_FILTERS, type PostSaleRuleFilter } from "@/features/post-sale-audit/auto-rules";
import {
  filterPostSaleSurveys,
  POST_SALE_STAGE_LABELS,
  POST_SALE_STAGE_ORDER,
  postSaleStage,
  postSaleSurveysCsv,
  sortPostSaleSurveys,
  type PostSaleListFilters,
  type PostSaleSurveyRow,
} from "@/features/post-sale-audit/overview";
import { RESPONSE_GROUP_LABELS, responseGroups, type ResponseGroup } from "@/features/post-sale-audit/responses-view";

import { PostSaleChips, PostSaleStageBadge } from "./post-sale-lead-panel";
import styles from "./post-sale.module.css";

const DATE_TIME = { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" } as const;

const COLUMNS: LiteColumn<PostSaleSurveyRow>[] = [
  { id: "lead", label: "Lead", primary: true, render: (row) => <span><span className={page.cellTitle}>{row.leadName}</span><span className={page.cellSub}>{row.brokerName ?? "Sem corretor"}</span></span> },
  { id: "rule", label: "Origem", nowrap: true, render: (row) => postSaleRuleLabel(row.ruleKey) },
  { id: "stage", label: "Situação", render: (row) => <PostSaleStageBadge row={row} /> },
  { id: "sent", label: "Enviada", render: (row) => <span className={page.numeric}>{row.sentAt ? formatLiteDate(row.sentAt, DATE_TIME) : "Não saiu"}</span> },
  { id: "answers", label: "Respostas", render: (row) => row.lastReplyAt ? <PostSaleChips row={row} limit={2} /> : <span className={page.muted}>Sem resposta</span> },
];

const dayLabel = (day: string) => day.split("-").reverse().slice(0, 2).join("/");

export function PostSaleLeads({ rows, filters, onFiltersChange, onOpen, periodDays }: {
  rows: PostSaleSurveyRow[];
  filters: PostSaleListFilters;
  onFiltersChange: (next: PostSaleListFilters) => void;
  onOpen: (row: PostSaleSurveyRow) => void;
  periodDays: number;
}) {
  const set = (patch: Partial<PostSaleListFilters>) => onFiltersChange({ ...filters, ...patch });

  const brokers = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.brokerId ?? "sem-corretor", row.brokerName ?? "Sem corretor");
    return [...map].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [rows]);

  // As contagens de situação e de resposta respeitam os outros filtros, para o número bater com a lista.
  const withoutStage = useMemo(() => filterPostSaleSurveys(rows, { ...filters, stage: "all" }), [rows, filters]);
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of withoutStage) counts.set(postSaleStage(row), (counts.get(postSaleStage(row)) ?? 0) + 1);
    counts.set("responded", withoutStage.filter((row) => row.lastReplyAt).length);
    return counts;
  }, [withoutStage]);
  const groupCounts = useMemo(() => {
    const counts = new Map<ResponseGroup, number>();
    for (const row of filterPostSaleSurveys(rows, { ...filters, group: "all" })) for (const group of responseGroups(row)) counts.set(group, (counts.get(group) ?? 0) + 1);
    return counts;
  }, [rows, filters]);
  const ruleOptions = useMemo(() => POST_SALE_RULE_FILTERS.filter((key) => key === "all" || key === filters.rule || rows.some((row) => key === "manual" ? !row.ruleKey : row.ruleKey === key)), [rows, filters.rule]);

  const filtered = useMemo(() => sortPostSaleSurveys(filterPostSaleSurveys(rows, filters)), [rows, filters]);
  const { pageRows, pagination } = useLitePages(filtered, 20);

  function exportCsv() {
    const blob = new Blob([`﻿${postSaleSurveysCsv(filtered)}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pos-venda-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const stageChips = [
    { id: "all", label: "Todas", count: withoutStage.length },
    { id: "responded", label: "Responderam", count: stageCounts.get("responded") ?? 0 },
    ...POST_SALE_STAGE_ORDER.filter((stage) => (stageCounts.get(stage) ?? 0) > 0 || filters.stage === stage).map((stage) => ({ id: stage, label: POST_SALE_STAGE_LABELS[stage], count: stageCounts.get(stage) ?? 0 })),
  ];
  const active = [
    ...(filters.day ? [{ id: "day", label: "Dia", value: dayLabel(filters.day) }] : []),
  ];
  const groupOptions = (Object.keys(RESPONSE_GROUP_LABELS) as ResponseGroup[]).filter((key) => key === "all" || key === filters.group || (groupCounts.get(key) ?? 0) > 0);

  return (
    <section className={page.group} aria-labelledby="pos-venda-leads">
      <div className={styles.cardHeadRow}>
        <div className={page.cardHead}>
          <h2 id="pos-venda-leads" className={page.sectionTitle}>Leads em pós-venda</h2>
          <p className={page.muted}>{filtered.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} pesquisas nos últimos {periodDays} dias. Clique para ver a conversa.</p>
        </div>
        <button type="button" className={page.button} onClick={exportCsv} disabled={!filtered.length}><Download aria-hidden="true" size={16} />Exportar</button>
      </div>

      <div className={styles.filters}>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" className={page.searchInput} aria-label="Buscar lead, corretor ou comentário" placeholder="Buscar lead, corretor ou comentário" value={filters.query} onChange={(event) => set({ query: event.target.value })} />
          </label>
        </div>
        <div className={styles.filterRow}>
          <LiteSelect label="Origem" value={filters.rule} onChange={(value) => set({ rule: value as PostSaleRuleFilter })} options={ruleOptions.map((key) => ({ value: key, label: key === "all" ? "Todas as origens" : postSaleRuleLabel(key === "manual" ? null : key) }))} />
          <LiteSelect label="Corretor" value={filters.brokerId || "all"} onChange={(value) => set({ brokerId: value === "all" ? "" : value })} options={[{ value: "all", label: "Todos os corretores" }, ...brokers.map(([id, name]) => ({ value: id, label: name }))]} />
          {groupOptions.length > 1 ? <LiteSelect label="Resposta" value={filters.group} onChange={(value) => set({ group: value as ResponseGroup })} options={groupOptions.map((key) => ({ value: key, label: key === "all" ? "Todas as respostas" : RESPONSE_GROUP_LABELS[key], count: key === "all" ? undefined : groupCounts.get(key) ?? 0 }))} /> : null}
        </div>
        <LiteFilterChips label="Situação" scroll active={[filters.stage]} onToggle={(id) => set({ stage: id as PostSaleListFilters["stage"] })} chips={stageChips} />
        {active.length ? <LiteFilterChips label="Filtros ativos" chips={active} onRemove={() => set({ day: "" })} /> : null}
      </div>

      <LiteResponsiveData
        caption="Leads em pós-venda"
        columns={COLUMNS}
        rows={pageRows}
        rowKey={(row) => row.id}
        onRowOpen={onOpen}
        empty={<p className={page.muted}>{rows.length ? "Nenhum lead com esses filtros." : `Nenhuma pesquisa nos últimos ${periodDays} dias.`}</p>}
      />
      <LitePagination label="Páginas de leads em pós-venda" itemNoun="pesquisas" {...pagination} />
    </section>
  );
}
