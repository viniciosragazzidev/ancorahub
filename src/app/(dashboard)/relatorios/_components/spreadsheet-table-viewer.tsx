"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { motion } from "motion/react";
import {
  ArrowsDownUp,
  ChevronDownIcon,
  ChevronUpIcon,
  MagnifyingGlass,
} from "@/components/huge-icons";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSpreadsheetDataAction, type ImportedSpreadsheet } from "./spreadsheet-actions";

export function SpreadsheetTableViewer({
  spreadsheetId,
  columns: columnDefs,
}: {
  spreadsheetId: string;
  columns: ImportedSpreadsheet["columns"];
}) {
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    getSpreadsheetDataAction(spreadsheetId).then((result) => {
      if (result.success && result.data) {
        setData(result.data.rows);
      }
      setLoading(false);
    });
  }, [spreadsheetId]);

  const columns = useMemo(() => {
    const colHelper = createColumnHelper<Record<string, unknown>>();
    return columnDefs.map((col) =>
      colHelper.accessor(col.key, {
        id: col.key,
        header: () => col.label,
        cell: (info) => {
          const value = info.getValue();
          if (value == null || value === "") return <span className="text-muted-foreground/50">—</span>;
          if (col.type === "number" && typeof value === "number") {
            return <span className="font-mono tabular-nums">{value.toLocaleString("pt-BR")}</span>;
          }
          return <span className="text-sm">{String(value)}</span>;
        },
        enableSorting: true,
      }),
    );
  }, [columnDefs]);

  const table = useReactTable({
    data: data ?? [],
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 25 },
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="size-6 rounded-full border-2 border-primary border-t-transparent"
        />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nenhum dado disponível.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search and filter bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <MagnifyingGlass className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar em toda a tabela..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} de {data.length} linha
          {data.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-border bg-muted/30">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                        {{          asc: <ChevronUpIcon className="size-3" />,
          desc: <ChevronDownIcon className="size-3" />,
                        }[header.column.getIsSorted() as string] ?? (
                          <ArrowsDownUp className="size-3 opacity-30" />
                        )}
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-border transition-colors hover:bg-muted/20 ${
                  i % 2 === 0 ? "bg-background" : "bg-muted/10"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-1.5 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>
            Página {table.getState().pagination.pageIndex + 1} de{" "}
            {table.getPageCount()}
          </span>
          <span className="mx-1">·</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="rounded border border-border bg-background px-1 py-0.5 text-xs"
          >
            {[10, 25, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} por página
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-7 px-2 text-xs"
          >
            Anterior
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-7 px-2 text-xs"
          >
            Próximo
          </Button>
        </div>
      </div>
    </div>
  );
}
