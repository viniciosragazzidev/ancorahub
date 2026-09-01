"use client";

import type { Table } from "@tanstack/react-table";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  pageSizeOptions?: number[];
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions = [10, 20, 50, 100],
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex flex-col-reverse items-center justify-between gap-4 px-2 py-3 sm:flex-row border-t border-border/50">
      <div className="flex-1 text-xs text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} de{" "}
        {table.getFilteredRowModel().rows.length} linha(s) selecionada(s).
      </div>
      <div className="flex items-center space-x-6 sm:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-xs font-medium text-muted-foreground">Linhas por página</p>
          <Select
            value={`${table.getState().pagination.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value));
            }}
          >
            <SelectTrigger className="h-8 w-[70px] text-xs">
              <SelectValue placeholder={table.getState().pagination.pageSize} />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`} className="text-xs">
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center text-xs font-medium text-muted-foreground">
          Página {table.getState().pagination.pageIndex + 1} de{" "}
          {table.getPageCount() > 0 ? table.getPageCount() : 1}
        </div>
        <div className="flex items-center space-x-1.5">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 sm:flex"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Primeira página</span>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <span className="sr-only">Página anterior</span>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="h-8 w-8 p-0"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Próxima página</span>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 sm:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Última página</span>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
