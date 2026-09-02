"use client";

import type { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";
import { useQueryState } from "nuqs";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableFilterMenu } from "@/components/data-table/data-table-filter-menu";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchPlaceholder?: string;
  children?: React.ReactNode;
}

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = "Buscar em todas as colunas...",
  children,
}: DataTableToolbarProps<TData>) {
  const [search, setSearch] = useQueryState("search", {
    defaultValue: "",
    history: "push",
    shallow: false,
  });

  return (
    <div className="flex flex-col gap-3 pb-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 items-center space-x-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 pr-8 text-xs bg-background"
            />
            {search && (
              <Button
                variant="ghost"
                size="xs"
                className="absolute right-1 top-1 h-6 w-6 p-0 hover:bg-muted"
                onClick={() => setSearch("")}
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </Button>
            )}
          </div>
          <DataTableFilterMenu table={table} />
          <DataTableSortList table={table} />
        </div>

        <div className="flex items-center space-x-2">
          {children}
          <DataTableViewOptions table={table} />
        </div>
      </div>

      <DataTableFilterList table={table} />
    </div>
  );
}
