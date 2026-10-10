"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { AppSelect } from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  showSelectionCount?: boolean;
}

export function DataTablePagination<TData>({
  table,
  showSelectionCount = true,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-border/60 text-xs">
      {showSelectionCount ? (
        <div className="flex-1 text-muted-foreground font-mono text-[11px]">
          {table.getFilteredSelectedRowModel().rows.length} de{" "}
          {table.getFilteredRowModel().rows.length} linha(s) selecionada(s).
        </div>
      ) : (
        <div className="flex-1 text-muted-foreground font-mono text-[11px]">
          Total de {table.getFilteredRowModel().rows.length} registro(s).
        </div>
      )}

      <div className="flex flex-wrap items-center gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="text-xs font-medium text-muted-foreground">Linhas por página</p>
          <AppSelect
            size="sm"
            className="w-20"
            value={String(table.getState().pagination.pageSize)}
            onValueChange={(val) => table.setPageSize(Number(val))}
            options={[10, 20, 30, 50, 100].map((pageSize) => ({
              value: String(pageSize),
              label: String(pageSize),
            }))}
          />
        </div>

        <div className="flex w-[100px] items-center justify-center text-xs font-medium font-mono text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de{" "}
          {table.getPageCount() || 1}
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Ir para a primeira página</span>
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Página anterior</span>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="size-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Próxima página</span>
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden size-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Ir para a última página</span>
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
