"use client";

import type { Table } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

interface DataTableSortListProps<TData> {
  table: Table<TData>;
}

export function DataTableSortList<TData>({
  table,
}: DataTableSortListProps<TData>) {
  const sortingState = table.getState().sorting;
  const sortableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanSort());

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <ArrowUpDown className="h-3.5 w-3.5" />
            Ordenação
            {sortingState.length > 0 && (
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px] tabular-nums">
                {sortingState.length}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-[220px] p-2 space-y-1">
        <DropdownMenuLabel className="text-xs font-semibold">Ordenar Por</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {sortableColumns.map((column) => {
          const isSorted = sortingState.find((s) => s.id === column.id);
          const label = column.columnDef.meta?.label ?? column.id;

          return (
            <div
              key={column.id}
              className="flex items-center justify-between px-2 py-1 hover:bg-muted/50 rounded-md text-xs cursor-pointer"
              onClick={() => {
                if (!isSorted) {
                  table.setSorting([{ id: column.id, desc: false }]);
                } else if (!isSorted.desc) {
                  table.setSorting([{ id: column.id, desc: true }]);
                } else {
                  table.setSorting([]);
                }
              }}
            >
              <span className="font-medium text-foreground">{label}</span>
              <div className="flex items-center gap-1">
                {isSorted ? (
                  isSorted.desc ? (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary">
                      <ArrowDown className="h-3 w-3" /> Desc
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary">
                      <ArrowUp className="h-3 w-3" /> Asc
                    </Badge>
                  )
                ) : (
                  <span className="text-[10px] text-muted-foreground">Inativo</span>
                )}
              </div>
            </div>
          );
        })}
        {sortingState.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <Button
              variant="ghost"
              size="xs"
              className="w-full text-xs text-rose-500 hover:text-rose-600 justify-start"
              onClick={() => table.setSorting([])}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Limpar ordenação
            </Button>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
