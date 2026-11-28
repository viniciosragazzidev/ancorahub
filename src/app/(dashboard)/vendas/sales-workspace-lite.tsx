"use client";

/**
 * /vendas no Lite (28/11/2026, artifact "Comercial", direção limpa): os números numa faixa só, a lista em tabela com
 * seleção (exportação em lote pela mesma Server Action), busca, unidade e período na barra (mesmos ?branch= e
 * ?period=), abas de status e a gaveta da venda no clique da linha, com o atalho para a venda completa. O "Comissões
 * do mês" baixa o mesmo CSV de antes.
 */
import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";

import { LiteBulkBar, LiteUrlSelect } from "@/components/lite/controls";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkExportSalesAction } from "@/features/sales/actions";
import { formatLiteDate } from "@/components/lite/format/date";
import { formatCurrency } from "@/features/quotes/utils";
import { ComercialPage, FilterTabs, ListFoot, SearchField, StatStrip, cm } from "@/features/comercial-lite/comercial-kit";
import { PlSheet } from "@/app/(dashboard)/leads/distribuicao/plantao/_components/plantoes-1a1-kit";
import { cn } from "@/lib/utils";
import { DEFAULT_PERIOD, PERIOD_OPTIONS, type PeriodValue } from "@/shared/period";

export type SaleLiteRow = {
  id: string;
  leadId: string;
  leadName: string;
  clientName: string | null;
  brokerId: string;
  brokerName: string | null;
  branchName: string | null;
  planName: string | null;
  carrierName: string | null;
  saleDate: string;
  saleValue: number;
  status: string;
  createdAt: string;
};

type StatusFilter = "all" | "active" | "cancelled";

const PAGE_SIZE = 10;
const COLUMNS = "28px minmax(200px, 1.5fr) minmax(140px, 1fr) minmax(120px, .9fr) minmax(160px, 1.1fr) 110px 120px 100px";

/** Ticket médio das vendas ativas (canceladas não entram); 0 sem venda ativa. */
export function averageSaleTicket(sales: Pick<SaleLiteRow, "status" | "saleValue">[]) {
  const active = sales.filter((sale) => sale.status === "active");
  return active.length ? Math.round((active.reduce((sum, sale) => sum + sale.saleValue, 0) / active.length) * 100) / 100 : 0;
}

function exportMonthCommissions() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  window.open(`/api/internal/export/commissions?startMonth=${month}&endMonth=${month}&format=csv`, "_blank");
}

const compactCurrency = (value: number) => value >= 10_000
  ? `R$ ${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value / 1000)} mil`
  : formatCurrency(value);

export function SalesWorkspaceLite({ sales, totalRevenue, currentRole, period, branches, branchId }: {
  sales: SaleLiteRow[];
  totalRevenue: number;
  currentRole?: string;
  period: PeriodValue;
  /** Unidades para o filtro (vazio esconde o seletor). */
  branches: { id: string; name: string }[];
  branchId?: string;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [openSale, setOpenSale] = useState<SaleLiteRow | null>(null);

  const filtered = useMemo(() => {
    const byStatus = status === "all" ? sales : sales.filter((sale) => sale.status === status);
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return byStatus;
    return byStatus.filter((sale) => [sale.leadName, sale.clientName ?? "", sale.brokerName ?? "", sale.planName ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [sales, status, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(pageNumber, totalPages);
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const ids = useMemo(() => filtered.map((sale) => sale.id), [filtered]);
  const multiSelect = useMultiSelect(ids);
  const clearSelection = multiSelect.clear;

  const [exportState, exportAction, exportPending] = useActionState(bulkExportSalesAction, {});
  // Mesmo download e mesmos avisos de antes.
  useEffect(() => {
    if (exportState.csvData && exportState.count) {
      const blob = new Blob([exportState.csvData], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vendas-exportadas-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${exportState.count} ${exportState.count === 1 ? "venda exportada" : "vendas exportadas"}.`);
      clearSelection();
    }
    if (exportState.error) toast.error(exportState.error);
  }, [exportState, clearSelection]);

  const exportSelected = () => {
    const formData = new FormData();
    for (const id of multiSelect.selectedIds) formData.append("saleId", id);
    startTransition(() => exportAction(formData));
  };

  const activeSales = sales.filter((sale) => sale.status === "active").length;
  const cancelledSales = sales.length - activeSales;
  const averageTicket = averageSaleTicket(sales);
  const summary = `${sales.length.toLocaleString("pt-BR")} ${sales.length === 1 ? "venda" : "vendas"} · ${formatCurrency(totalRevenue)} em ${period} dias`;
  const changeQuery = (value: string) => { setQuery(value); setPageNumber(1); };
  const changeStatus = (value: StatusFilter) => { setStatus(value); setPageNumber(1); };

  return (
    <ComercialPage
      title="Vendas"
      summary={summary}
      actions={<button type="button" className={cn(cm.pill, cm.quiet)} onClick={exportMonthCommissions} title="Baixa as comissões do mês atual em CSV">Comissões do mês</button>}
    >
      <StatStrip items={[
        { label: "Vendas", value: sales.length, detail: `últimos ${period} dias` },
        { label: "Ativas", value: activeSales, detail: `${cancelledSales} ${cancelledSales === 1 ? "cancelada" : "canceladas"}` },
        { label: "Receita", value: compactCurrency(totalRevenue), detail: "acumulado no período" },
        { label: "Ticket médio", value: formatCurrency(averageTicket), detail: "por venda ativa" },
      ]} />

      <section className={cm.card} aria-label="Lista de vendas">
        <div className={cm.bar}>
          <SearchField value={query} onChange={changeQuery} placeholder="Buscar lead, corretor ou plano" label="Buscar vendas" />
          {branches.length > 1 ? (
            <LiteUrlSelect className={page.select} label="Unidade" param="branch" value={branchId ?? ""} resetPage options={[{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
          ) : null}
          <LiteUrlSelect className={page.selectNarrow} label="Período" param="period" value={String(period)} defaultValue={String(DEFAULT_PERIOD)} method="replace" options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
        </div>

        {sales.length === 0 ? (
          <div className={cm.empty}>
            <h2 className={cm.emptyTitle}>Nenhuma venda registrada ainda</h2>
            <p className={cm.emptyText}>As vendas aparecem aqui assim que um lead é fechado como vendido.</p>
            <Link href="/leads" className={cn(cm.pill, cm.primary)}>Ir para leads</Link>
          </div>
        ) : (
          <>
            <FilterTabs<StatusFilter> label="Filtrar vendas por status" value={status} onChange={changeStatus} items={[
              { value: "all", label: "Todas", count: sales.length },
              { value: "active", label: "Ativas", count: activeSales },
              { value: "cancelled", label: "Canceladas", count: cancelledSales },
            ]} />
            {query.trim() ? (
              <p className={cm.resultLine} role="status">
                {filtered.length} {filtered.length === 1 ? "venda" : "vendas"} para “{query.trim()}” · <button type="button" onClick={() => changeQuery("")}>Limpar busca</button>
              </p>
            ) : null}

            <div className={cm.desktopOnly} style={{ overflowX: "auto" }}>
              <div className={cm.tableMin} role="table" aria-label="Vendas">
                <div className={cn(cm.row, cm.th)} role="row" style={{ gridTemplateColumns: COLUMNS }}>
                  <span role="columnheader"><input type="checkbox" className={cm.check} checked={multiSelect.isAllSelected} onChange={() => multiSelect.selectAll()} aria-label="Selecionar todas as vendas" /></span>
                  <span role="columnheader">Lead</span><span role="columnheader">Corretor</span><span role="columnheader">Unidade</span>
                  <span role="columnheader">Plano</span><span role="columnheader">Data</span><span role="columnheader" className={cm.right}>Valor</span><span role="columnheader">Status</span>
                </div>
                {pageRows.length ? pageRows.map((sale) => (
                  <div key={sale.id} className={cm.row} role="row" tabIndex={0} style={{ gridTemplateColumns: COLUMNS }}
                    onClick={() => setOpenSale(sale)} onKeyDown={(event) => { if (event.key === "Enter") setOpenSale(sale); }}>
                    <span role="cell" onClick={(event) => event.stopPropagation()}>
                      <input type="checkbox" className={cm.check} checked={multiSelect.isSelected(sale.id)} onChange={() => multiSelect.toggle(sale.id)} aria-label={`Selecionar venda ${sale.leadName}`} />
                    </span>
                    <span role="cell"><span className={cm.t1}>{sale.leadName}</span>{sale.clientName ? <span className={cm.sub}>{sale.clientName}</span> : null}</span>
                    <span role="cell" className={cn(cm.cell, !sale.brokerName && cm.muted)}>{sale.brokerName ?? "Sem corretor"}</span>
                    <span role="cell" className={cn(cm.cell, cm.muted)}>{sale.branchName ?? "Sem unidade"}</span>
                    <span role="cell"><span className={cn(cm.t1, !sale.planName && cm.muted)} style={{ fontWeight: 400 }}>{sale.planName ?? "Não informado"}</span>{sale.carrierName ? <span className={cm.sub}>{sale.carrierName}</span> : null}</span>
                    <span role="cell" className={cn(cm.num, cm.muted)}>{formatLiteDate(sale.saleDate)}</span>
                    <span role="cell" className={cn(cm.num, cm.right)}>{formatCurrency(sale.saleValue)}</span>
                    <span role="cell"><span className={cn(cm.badge, sale.status === "active" && cm.bGood)}>{sale.status === "active" ? "Ativa" : "Cancelada"}</span></span>
                  </div>
                )) : <div className={cm.empty}><p className={cm.emptyText}>Nenhuma venda encontrada. Ajuste a busca ou o filtro de status.</p></div>}
              </div>
            </div>

            <div className={cm.mobileOnly}>
              {pageRows.map((sale) => (
                <div key={sale.id} className={cm.mRow} role="button" tabIndex={0} onClick={() => setOpenSale(sale)} onKeyDown={(event) => { if (event.key === "Enter") setOpenSale(sale); }}>
                  <span className={cm.mBody}><span className={cm.t1}>{sale.leadName}</span><span className={cm.sub}>{sale.brokerName ?? "Sem corretor"} · {formatLiteDate(sale.saleDate)}</span></span>
                  <span className={cm.mEnd}><span className={cm.num}>{formatCurrency(sale.saleValue)}</span><span className={cn(cm.badge, sale.status === "active" && cm.bGood)}>{sale.status === "active" ? "Ativa" : "Cancelada"}</span></span>
                </div>
              ))}
            </div>

            <ListFoot page={current} totalPages={totalPages} total={filtered.length} pageSize={PAGE_SIZE} noun="vendas" onPage={setPageNumber} label="Páginas de vendas" />
          </>
        )}
      </section>

      <PlSheet
        open={Boolean(openSale)}
        onOpenChange={(open) => { if (!open) setOpenSale(null); }}
        title={openSale?.leadName ?? "Venda"}
        description={openSale ? `${formatCurrency(openSale.saleValue)} · ${formatLiteDate(openSale.saleDate)}` : undefined}
        badges={openSale ? <span className={cn(cm.badge, openSale.status === "active" && cm.bGood)}>{openSale.status === "active" ? "Ativa" : "Cancelada"}</span> : null}
        footer={openSale ? <Link href={`/vendas/${openSale.id}`} className={cn(cm.pill, cm.primary)} style={{ flex: 1 }}>Abrir venda completa</Link> : null}
      >
        {openSale ? (
          <dl className={cn(cm.dl, cm.num)}>
            <dt>Cliente</dt><dd>{openSale.clientName ?? "Ainda não cadastrado"}</dd>
            <dt>Corretor</dt><dd>{openSale.brokerName ?? "Sem corretor"}</dd>
            <dt>Unidade</dt><dd>{openSale.branchName ?? "Sem unidade"}</dd>
            <dt>Plano</dt><dd>{openSale.planName ?? "Não informado"}</dd>
            <dt>Operadora</dt><dd>{openSale.carrierName ?? "Não informada"}</dd>
            <dt>Data da venda</dt><dd>{formatLiteDate(openSale.saleDate)}</dd>
            <dt>Valor</dt><dd>{formatCurrency(openSale.saleValue)}</dd>
            <dt>Lead</dt><dd><Link href={`/leads/${openSale.leadId}`}>Abrir o lead</Link></dd>
          </dl>
        ) : null}
      </PlSheet>

      {currentRole ? (
        <LiteBulkBar
          count={multiSelect.count}
          onClear={multiSelect.clear}
          actions={[{ id: "export", label: exportPending ? "Exportando…" : "Exportar CSV", shortLabel: "Exportar", onRun: exportSelected, disabled: exportPending }]}
        />
      ) : null}
    </ComercialPage>
  );
}
