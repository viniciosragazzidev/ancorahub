"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { FileArrowDown } from "@/components/huge-icons";

import { SaleStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";
import { SelectionToolbar } from "@/components/ui/selection-toolbar";
import { StatCard } from "@/components/dashboard/metric-card";
import { MetricsOverview } from "@/components/dashboard/metrics-overview";
import { useMultiSelect } from "@/hooks/use-multi-select";
import { bulkExportSalesAction } from "@/features/sales/actions";
import { formatCurrency, formatDate } from "@/features/quotes/utils";
import { monthlyCounts, monthlySums } from "@/shared/trends";

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
}: {
  sales: SaleRow[];
  totalRevenue: number;
  currentRole?: string;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");

  const filteredSales = useMemo(() => {
    if (statusFilter === "all") return sales;
    return sales.filter((s) => s.status === statusFilter);
  }, [sales, statusFilter]);

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
      total: monthlyCounts(saleDates),
      active: monthlyCounts(activeDates),
      revenue: monthlySums(
        sales.map((s) => ({ date: new Date(s.saleDate), value: s.saleValue })),
      ),
    };
  }, [sales]);

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
            <p className="font-medium text-xs text-foreground">{sale.leadName}</p>
            {sale.clientName && (
              <p className="text-[11px] text-muted-foreground">{sale.clientName}</p>
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
      cell: ({ row }) => row.original.brokerName ?? "—",
    },
    {
      accessorKey: "branchName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Filial" />
      ),
      cell: ({ row }) => row.original.branchName ?? "—",
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
              <span className="ml-1 text-[11px] text-muted-foreground">({sale.carrierName})</span>
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
      <MetricsOverview columns={4}>
        <StatCard
          variant="overview"
          label="Total de vendas"
          value={sales.length}
          sublabel="últimos 6 meses"
          sparklineData={salesTrend.total}
          sparklineColor="var(--chart-1)"
          animated
        />
        <StatCard
          variant="overview"
          label="Vendas ativas"
          value={activeSales}
          sublabel="em andamento"
          sparklineData={salesTrend.active}
          sparklineColor="var(--chart-3)"
          animated
          animationDelay={0.06}
        />
        <StatCard
          variant="overview"
          label="Receita total"
          value={formatCurrency(totalRevenue)}
          sublabel="acumulado no período"
          sparklineData={salesTrend.revenue}
          sparklineColor="var(--chart-2)"
          animated
          animationDelay={0.12}
        />
        <StatCard
          variant="overview"
          label="Comissão a repassar"
          value={formatCurrency(totalRevenue)}
          sublabel="gerada nas vendas"
          sparklineData={salesTrend.revenue}
          sparklineColor="var(--chart-4)"
          animated
          animationDelay={0.18}
        />
      </MetricsOverview>

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

      {/* Data Table */}
      <DataTable
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
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "cancelled")}
              className="h-9 rounded-md border border-input bg-background px-3 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              aria-label="Filtrar por status"
            >
              <option value="all">Todas as vendas</option>
              <option value="active">Ativas</option>
              <option value="cancelled">Canceladas</option>
            </select>

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
      />
    </div>
  );
}
