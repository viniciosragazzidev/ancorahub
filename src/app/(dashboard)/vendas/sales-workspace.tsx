"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowRight } from "lucide-react";
import { FileArrowDown } from "@/components/huge-icons";

import { SaleStatusBadge } from "@/components/status-badges";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, DataTableColumnHeader } from "@/components/ui/data-table";

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

import { formatCurrency, formatDate } from "@/features/quotes/utils";

// SaleStatusBadge compartilhado de @/components/status-badges

export const columns: ColumnDef<SaleRow>[] = [
  {
    accessorKey: "leadName",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lead / Cliente" />
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
    header: "Plano",
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
      <DataTableColumnHeader column={column} title="Data" />
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
    header: "Status",
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

export function SalesWorkspace({
  sales,
  totalRevenue,
}: {
  sales: SaleRow[];
  totalRevenue: number;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "cancelled">("all");

  const filteredSales = useMemo(() => {
    if (statusFilter === "all") return sales;
    return sales.filter((s) => s.status === statusFilter);
  }, [sales, statusFilter]);

  const activeSales = sales.filter((s) => s.status === "active").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <motion.div
        className="grid gap-3 sm:grid-cols-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
        }}
      >
        {[
          { label: "Total de vendas", value: sales.length },
          { label: "Vendas ativas", value: activeSales },
          { label: "Receita total", value: formatCurrency(totalRevenue) },
          { label: "Comissão a repassar", value: formatCurrency(totalRevenue) },
        ].map((item) => (
          <motion.div
            key={item.label}
            variants={{
              hidden: { opacity: 0, y: 8 },
              visible: { opacity: 1, y: 0, transition: { duration: 0.18, ease: [0, 0, 0.2, 1] } },
            }}
            whileHover={{ y: -2, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } }}
            whileTap={{ scale: 0.995, transition: { duration: 0.1 } }}
          >
            <Card size="sm" className="group/card border-border bg-card shadow-none transition-all duration-200 hover:border-primary/25 hover:shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground transition-colors duration-200 group-hover/card:text-foreground">{item.label}</p>
                <p className="mt-2 font-mono text-lg font-semibold transition-colors duration-200 group-hover/card:text-primary">{item.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* TanStack Data Table Container */}
      <DataTable
        columns={columns}
        data={filteredSales}
        searchKey="leadName"
        searchPlaceholder="Buscar por lead, corretor ou plano..."
        showColumnToggle={true}
        showPagination={true}
        pageSize={10}
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
