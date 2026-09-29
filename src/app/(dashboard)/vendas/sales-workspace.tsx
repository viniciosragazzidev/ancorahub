"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight, Search } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { FileArrowDown } from "@/components/huge-icons";

import { SaleStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AppSelect } from "@/components/ui/select";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { MobileDataList, MobileDataListItem, MobileDataRow, ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { StatCard } from "@/components/dashboard/metric-card";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkExportSalesAction } from "@/features/sales/actions";
import { formatCurrency, formatDate } from "@/features/quotes/utils";
import { dailyCounts, dailySums } from "@/shared/trends";
import type { PeriodValue } from "@/shared/period";

type SaleRow = {
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

export function SalesWorkspace({
  sales,
  totalRevenue,
  currentRole,
  period,
}: {
  sales: SaleRow[];
  totalRevenue: number;
  currentRole?: string;
  period: PeriodValue;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");
  const [mobileQuery, setMobileQuery] = useState("");

  const filteredSales = useMemo(() => {
    if (statusFilter === "all") return sales;
    return sales.filter((s) => s.status === statusFilter);
  }, [sales, statusFilter]);
  const mobileSales = useMemo(() => {
    const query = mobileQuery.trim().toLocaleLowerCase("pt-BR");
    if (!query) return filteredSales;
    return filteredSales.filter((sale) =>
      [sale.leadName, sale.clientName ?? "", sale.brokerName ?? "", sale.planName ?? ""]
        .some((value) => value.toLocaleLowerCase("pt-BR").includes(query)),
    );
  }, [filteredSales, mobileQuery]);

  const saleIds = useMemo(() => filteredSales.map((s) => s.id), [filteredSales]);
  const multiSelect = useMultiSelect(saleIds);
  const clearSelection = multiSelect.clear;

  const [exportState, exportFormAction, exportPending] = useActionState(
    bulkExportSalesAction,
    {},
  );

  // Trigger CSV download when data arrives
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
    if (exportState.error) {
      toast.error(exportState.error);
    }
  }, [exportState, clearSelection]);

  const activeSales = sales.filter((s) => s.status === "active").length;

  const salesTrend = useMemo(() => {
    const saleDates = sales.map((s) => new Date(s.saleDate));
    const activeDates = sales
      .filter((s) => s.status === "active")
      .map((s) => new Date(s.saleDate));
    return {
      total: dailyCounts(saleDates, period),
      active: dailyCounts(activeDates, period),
      revenue: dailySums(
        sales.map((s) => ({ date: new Date(s.saleDate), value: s.saleValue })),
        period,
      ),
    };
  }, [sales, period]);

  const columns: ColumnDef<SaleRow>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          aria-label="Selecionar todos"
          checked={multiSelect.isAllSelected}
          onCheckedChange={multiSelect.selectAll}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          aria-label={`Selecionar venda ${row.original.leadName}`}
          checked={multiSelect.isSelected(row.original.id)}
          onCheckedChange={() => multiSelect.toggle(row.original.id)}
          onClick={(event) => event.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "leadName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Lead" />
      ),
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <div>
            <p className="font-semibold text-xs text-foreground leading-snug">{sale.leadName}</p>
            {sale.clientName && (
              <p className="text-xs text-muted-foreground">{sale.clientName}</p>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "brokerName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Corretor" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.brokerName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "branchName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Filial" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.branchName ?? "—"}</span>
      ),
    },
    {
      accessorKey: "planName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Plano" />
      ),
      cell: ({ row }) => {
        const sale = row.original;
        return (
          <div>
            <span className="text-xs text-foreground">{sale.planName ?? "—"}</span>
            {sale.carrierName && (
              <span className="ml-1 text-xs text-muted-foreground">({sale.carrierName})</span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "saleDate",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Data da venda" />
      ),
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground font-mono">{formatDate(row.original.saleDate)}</span>
      ),
    },
    {
      accessorKey: "saleValue",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Valor" className="justify-end" />
      ),
      cell: ({ row }) => (
        <div className="text-right font-mono text-xs font-semibold text-foreground">
          {formatCurrency(row.original.saleValue)}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Status" />
      ),
      cell: ({ row }) => <SaleStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="text-right">
          <Button
            size="sm"
            variant="ghost"
            render={<Link href={`/vendas/${row.original.id}`} />}
            aria-label="Ver detalhes"
            className="h-8 gap-1 text-xs"
          >
            Ver detalhes <ArrowRight className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
        <StatCard
          label="Total de vendas"
          value={sales.length}
          sublabel={`últimos ${period} dias`}
          sparklineData={salesTrend.total}
          sparklineColor="var(--chart-1)"
          animated
        />
        <StatCard
          label="Vendas ativas"
          value={activeSales}
          sublabel="em andamento"
          sparklineData={salesTrend.active}
          sparklineColor="var(--chart-3)"
          animated
          animationDelay={0.06}
        />
        <StatCard
          label="Receita total"
          value={formatCurrency(totalRevenue)}
          sublabel="acumulado no período"
          sparklineData={salesTrend.revenue}
          sparklineColor="var(--chart-2)"
          animated
          animationDelay={0.12}
        />
        <StatCard
          label="Comissão a repassar"
          value={formatCurrency(totalRevenue)}
          sublabel="gerada nas vendas"
          sparklineData={salesTrend.revenue}
          sparklineColor="var(--chart-4)"
          animated
          animationDelay={0.18}
        />
      </div>

      {/* Bulk selection toolbar */}
      <SelectionToolbar
        selectedCount={multiSelect.count}
        totalCount={filteredSales.length}
        onClear={multiSelect.clear}
      >
        {currentRole && (
          <form action={exportFormAction} className="flex items-center gap-2">
            {multiSelect.selectedIds.map((id) => (
              <input key={id} name="saleId" type="hidden" value={id} />
            ))}
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1"
              disabled={exportPending || multiSelect.count === 0}
              type="submit"
            >
              <FileArrowDown className="size-3.5" />
              Exportar CSV
            </Button>
          </form>
        )}
      </SelectionToolbar>

      <div className="space-y-2.5 sm:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            aria-label="Buscar vendas"
            className="h-(--mobile-touch-target) pl-9"
            onChange={(event) => setMobileQuery(event.target.value)}
            placeholder="Buscar por lead, corretor ou plano"
            value={mobileQuery}
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]">
          <AppSelect
            aria-label="Filtrar por status"
            className="w-40 shrink-0"
            value={statusFilter}
            onValueChange={(val) => setStatusFilter(val as "all" | "active" | "cancelled")}
            options={[
              { value: "all", label: "Todas as vendas" },
              { value: "active", label: "Ativas" },
              { value: "cancelled", label: "Canceladas" },
            ]}
          />
          <Button
            className="min-h-(--mobile-touch-target) shrink-0"
            onClick={() => {
              const now = new Date();
              const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
              window.open(`/api/internal/export/commissions?startMonth=${month}&endMonth=${month}&format=csv`, "_blank");
            }}
            variant="outline"
          >
            <FileArrowDown className="size-3.5" /> Exportar CSV
          </Button>
        </div>
      </div>

      <ResponsiveDataView
        desktop={<DataTable
        columns={columns}
        data={filteredSales}
        searchKey="leadName"
        searchPlaceholder="Buscar por lead, corretor ou plano..."
        showColumnToggle={true}
        showPagination={true}
        pageSize={10}
        getRowClassName={(sale) => sale.status === "active" ? "bg-muted/15" : undefined}
        emptyState={
          filteredSales.length === 0 && sales.length === 0 ? (
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/8 ring-1 ring-primary/15">
                <svg className="size-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="max-w-sm space-y-1.5">
                <p className="text-sm font-semibold text-foreground">Nenhuma venda registrada ainda</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Equipes que fecham a primeira venda nos primeiros 3 dias têm 4× mais chance de bater a meta mensal. Registre sua primeira venda agora.
                </p>
              </div>
              <Link href="/leads" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
                <ArrowRight className="size-3.5" /> Ir para Leads para registrar
              </Link>
            </div>
          ) : undefined
        }
        headerSlot={
          <div className="flex items-center gap-2">
            <AppSelect
              aria-label="Filtrar por status"
              size="sm"
              className="w-40"
              value={statusFilter}
              onValueChange={(val) => setStatusFilter(val as "all" | "active" | "cancelled")}
              options={[
                { value: "all", label: "Todas as vendas" },
                { value: "active", label: "Ativas" },
                { value: "cancelled", label: "Canceladas" },
              ]}
            />

            <Button
              size="sm"
              variant="outline"
              className="h-9 text-xs gap-1"
              onClick={() => {
                const now = new Date();
                const m = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                window.open(`/api/internal/export/commissions?startMonth=${m}&endMonth=${m}&format=csv`, "_blank");
              }}
            >
              <FileArrowDown className="size-3.5" /> Exportar CSV
            </Button>
          </div>
        }
        />}
        mobile={
          mobileSales.length ? (
            <MobileDataList>
              {mobileSales.map((sale) => (
                <MobileDataListItem key={sale.id}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      aria-label={`Selecionar venda ${sale.leadName}`}
                      checked={multiSelect.isSelected(sale.id)}
                      className="mt-0.5"
                      onCheckedChange={() => multiSelect.toggle(sale.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-foreground">{sale.leadName}</h3>
                          <p className="truncate text-xs text-muted-foreground">{sale.planName ?? "Plano não informado"}{sale.carrierName ? ` · ${sale.carrierName}` : ""}</p>
                        </div>
                        <SaleStatusBadge status={sale.status} />
                      </div>
                      <div className="mt-3 space-y-2">
                        <MobileDataRow label="Valor" value={formatCurrency(sale.saleValue)} />
                        <MobileDataRow label="Data" value={formatDate(sale.saleDate)} />
                        <MobileDataRow label="Corretor" value={sale.brokerName ?? "—"} />
                      </div>
                      <Button
                        className="mt-3 w-full min-h-(--mobile-touch-target)"
                        render={<Link href={`/vendas/${sale.id}`} />}
                        variant="outline"
                      >
                        Ver detalhes <ArrowRight className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                </MobileDataListItem>
              ))}
            </MobileDataList>
          ) : (
            <div className="rounded-[var(--radius-card)] border border-border bg-card px-4 py-8 text-center">
              <p className="text-sm font-semibold text-foreground">Nenhuma venda encontrada</p>
              <p className="mt-1 text-xs text-muted-foreground">Ajuste a busca ou o filtro de status.</p>
            </div>
          )
        }
      />
    </div>
  );
}
