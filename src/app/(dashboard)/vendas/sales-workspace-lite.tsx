"use client";

/**
 * /vendas no visual Lite do diretor: os mesmos números (com as mesmas tendências), a mesma busca e o mesmo filtro de
 * status, unidade e período na barra (mesmos ?branch= e ?period=), a lista Lite (tabela no desktop, cartões no
 * celular) com seleção e a exportação em lote pela mesma Server Action, e o "Exportar CSV" de comissões do mês.
 */
import Link from "next/link";
import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { ArrowRight, Download, Search } from "lucide-react";

import { StatCard } from "@/components/dashboard/metric-card";
import { LiteBulkBar, LiteSelect, LiteUrlSelect } from "@/components/lite/controls";
import { LiteResponsiveData, type LiteColumn } from "@/components/lite/data/data";
import { LitePagination, useLitePages } from "@/components/lite/data/pagination";
import page from "@/components/lite/page/lite-page.module.css";
import { toast } from "@/components/ui/sonner";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkExportSalesAction } from "@/features/sales/actions";
import { formatCurrency, formatDate } from "@/features/quotes/utils";
import { dailyCounts, dailySums } from "@/shared/trends";
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

function exportMonthCommissions() {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  window.open(`/api/internal/export/commissions?startMonth=${month}&endMonth=${month}&format=csv`, "_blank");
}

export function SalesWorkspaceLite({ sales, totalRevenue, currentRole, period, branches, branchId }: {
  sales: SaleLiteRow[];
  totalRevenue: number;
  currentRole?: string;
  period: PeriodValue;
  /** Unidades para o filtro (vazio esconde o seletor, como o BranchSelect com 1 unidade ou menos). */
  branches: { id: string; name: string }[];
  branchId?: string;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const byStatus = status === "all" ? sales : sales.filter((sale) => sale.status === status);
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return byStatus;
    return byStatus.filter((sale) => [sale.leadName, sale.clientName ?? "", sale.brokerName ?? "", sale.planName ?? ""]
      .some((value) => value.toLocaleLowerCase("pt-BR").includes(needle)));
  }, [sales, status, query]);

  const ids = useMemo(() => filtered.map((sale) => sale.id), [filtered]);
  const multiSelect = useMultiSelect(ids);
  const clearSelection = multiSelect.clear;
  const { pageRows, pagination } = useLitePages(filtered, PAGE_SIZE);

  const [exportState, exportAction, exportPending] = useActionState(bulkExportSalesAction, {});
  // Mesmo download e mesmos avisos da tela atual.
  useEffect(() => {
    if (exportState.csvData && exportState.count) {
      const blob = new Blob([exportState.csvData], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `vendas-exportadas-${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`${exportState.count} venda(s) exportada(s).`);
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
  const trend = useMemo(() => ({
    total: dailyCounts(sales.map((sale) => new Date(sale.saleDate)), period),
    active: dailyCounts(sales.filter((sale) => sale.status === "active").map((sale) => new Date(sale.saleDate)), period),
    revenue: dailySums(sales.map((sale) => ({ date: new Date(sale.saleDate), value: sale.saleValue })), period),
  }), [sales, period]);

  const columns = useMemo<LiteColumn<SaleLiteRow>[]>(() => [
    {
      id: "lead",
      label: "Lead",
      primary: true,
      render: (sale) => (
        <span>
          <span className={page.cellTitle}>{sale.leadName}</span>
          {sale.clientName ? <span className={page.cellSub}>{sale.clientName}</span> : null}
        </span>
      ),
    },
    { id: "broker", label: "Corretor", render: (sale) => sale.brokerName ?? <span className={page.muted}>Sem corretor</span> },
    { id: "branch", label: "Filial", render: (sale) => sale.branchName ?? <span className={page.muted}>Sem filial</span> },
    {
      id: "plan",
      label: "Plano",
      render: (sale) => (
        <span>
          {sale.planName ?? <span className={page.muted}>Não informado</span>}
          {sale.carrierName ? <span className={page.cellSub}>{sale.carrierName}</span> : null}
        </span>
      ),
    },
    { id: "date", label: "Data da venda", render: (sale) => <span className={page.numeric}>{formatDate(sale.saleDate)}</span> },
    { id: "value", label: "Valor", numeric: true, render: (sale) => <span className={page.numeric}>{formatCurrency(sale.saleValue)}</span> },
    {
      id: "status",
      label: "Status",
      render: (sale) => <span className={page.badge} data-tone={sale.status === "active" ? "success" : undefined}>{sale.status === "active" ? "Ativa" : "Cancelada"}</span>,
    },
    {
      id: "actions",
      label: "Ações",
      numeric: true,
      render: (sale) => (
        <Link href={`/vendas/${sale.id}`} className={page.button} aria-label={`Ver detalhes da venda de ${sale.leadName}`}>
          Ver detalhes <ArrowRight aria-hidden="true" size={16} />
        </Link>
      ),
    },
  ], []);

  const selection = {
    isSelected: (sale: SaleLiteRow) => multiSelect.isSelected(sale.id),
    onToggle: (sale: SaleLiteRow) => multiSelect.toggle(sale.id),
    allSelected: multiSelect.isAllSelected,
    onToggleAll: () => multiSelect.selectAll(),
    rowLabel: (sale: SaleLiteRow) => `Selecionar venda ${sale.leadName}`,
  };

  return (
    <div className={`arc-venancor ${page.stack}`} data-skin="diretor">
      <div className={page.stats}>
        <StatCard label="Total de vendas" value={sales.length} sublabel={`últimos ${period} dias`} sparklineData={trend.total} sparklineColor="var(--chart-1)" animated />
        <StatCard label="Vendas ativas" value={activeSales} sublabel="em andamento" sparklineData={trend.active} sparklineColor="var(--chart-3)" animated animationDelay={0.06} />
        <StatCard label="Receita total" value={formatCurrency(totalRevenue)} sublabel="acumulado no período" sparklineData={trend.revenue} sparklineColor="var(--chart-2)" animated animationDelay={0.12} />
        <StatCard label="Comissão a repassar" value={formatCurrency(totalRevenue)} sublabel="gerada nas vendas" sparklineData={trend.revenue} sparklineColor="var(--chart-4)" animated animationDelay={0.18} />
      </div>

      <div className={page.group}>
        <div className={page.toolbar}>
          <label className={page.search}>
            <Search aria-hidden="true" size={18} className={page.searchIcon} />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por lead, corretor ou plano" aria-label="Buscar vendas" className={page.searchInput} />
          </label>
          <div className={page.select}>
            <LiteSelect label="Status" hideLabel value={status} onChange={(value) => setStatus(value as StatusFilter)} options={[{ value: "all", label: "Todas as vendas" }, { value: "active", label: "Ativas" }, { value: "cancelled", label: "Canceladas" }]} />
          </div>
          {branches.length > 1 ? (
            <LiteUrlSelect className={page.select} label="Unidade" param="branch" value={branchId ?? ""} resetPage options={[{ value: "", label: "Todas as unidades" }, ...branches.map((branch) => ({ value: branch.id, label: branch.name }))]} />
          ) : null}
          <LiteUrlSelect className={page.selectNarrow} label="Período" param="period" value={String(period)} defaultValue={String(DEFAULT_PERIOD)} method="replace" options={PERIOD_OPTIONS.map((days) => ({ value: String(days), label: `${days} dias` }))} />
          <button type="button" className={`${page.button} ${page.toolbarEnd}`} onClick={exportMonthCommissions}>
            <Download aria-hidden="true" size={16} /> Exportar CSV
          </button>
        </div>

        {sales.length === 0 ? (
          <div className={page.empty}>
            <h2 className={page.emptyTitle}>Nenhuma venda registrada ainda</h2>
            <p className={page.emptyText}>Equipes que fecham a primeira venda nos primeiros 3 dias têm 4× mais chance de bater a meta mensal. Registre a primeira venda pelos leads.</p>
            <Link href="/leads" className={page.primaryButton}>Ir para leads <ArrowRight aria-hidden="true" size={16} /></Link>
          </div>
        ) : (
          <>
            <LiteResponsiveData
              caption="Vendas"
              columns={columns}
              rows={pageRows}
              rowKey={(sale) => sale.id}
              selection={selection}
              empty={<p>Nenhuma venda encontrada. Ajuste a busca ou o filtro de status.</p>}
            />
            <LitePagination label="Páginas de vendas" {...pagination} />
          </>
        )}
      </div>

      {currentRole ? (
        <LiteBulkBar
          count={multiSelect.count}
          onClear={multiSelect.clear}
          actions={[{ id: "export", label: exportPending ? "Exportando..." : "Exportar CSV", shortLabel: "Exportar", onRun: exportSelected }]}
        />
      ) : null}
    </div>
  );
}
