"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Filter, Plus, X } from "lucide-react";
import { parseAsArrayOf, useQueryState } from "nuqs";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { dataTableConfig } from "@/config/data-table";
import { filterItemParser } from "@/lib/parsers";
import type { ExtendedColumnFilter, FilterOperator } from "@/types/data-table";

interface DataTableFilterListProps<TData> {
  table: Table<TData>;
}

export function DataTableFilterList<TData>({
  table,
}: DataTableFilterListProps<TData>) {
  const [filters, setFilters] = useQueryState(
    "filters",
    filterItemParser.withOptions({ history: "push", shallow: false }).withDefault([])
  );

  const filterableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanFilter());

  const removeFilter = (id: string) => {
    setFilters(filters.filter((f) => f.id !== id));
  };

  const clearAllFilters = () => {
    setFilters([]);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map((filter) => {
        const column = table.getColumn(filter.id);
        if (!column) return null;

        const label = column.columnDef.meta?.label ?? filter.id;
        const operatorLabel =
          dataTableConfig.comparisonOperators.find(
            (op) => op.value === filter.operator
          )?.label ?? filter.operator;

        const displayValue = Array.isArray(filter.value)
          ? filter.value.join(", ")
          : String(filter.value);

        return (
          <Badge
            key={filter.id}
            variant="secondary"
            className="h-7 gap-1.5 px-2.5 text-xs font-normal border border-border/60 bg-muted/40 hover:bg-muted text-foreground"
          >
            <span className="font-semibold text-primary">{label}</span>
            <span className="text-muted-foreground">{operatorLabel}</span>
            <span className="font-medium text-foreground max-w-[150px] truncate">
              "{displayValue}"
            </span>
            <Button
              variant="ghost"
              size="xs"
              className="h-4 w-4 p-0 hover:bg-rose-500/20 hover:text-rose-500 rounded-full"
              onClick={() => removeFilter(filter.id)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        );
      })}

      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="xs"
          className="h-7 text-xs text-muted-foreground hover:text-rose-500"
          onClick={clearAllFilters}
        >
          Limpar filtros ({filters.length})
        </Button>
      )}
    </div>
  );
}
