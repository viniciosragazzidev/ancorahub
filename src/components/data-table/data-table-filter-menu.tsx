"use client";

import * as React from "react";
import type { Table } from "@tanstack/react-table";
import { Filter, Plus } from "lucide-react";
import { parseAsInteger, useQueryState } from "nuqs";
import { useRouter } from "next/navigation";

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
import type { FilterOperator } from "@/types/data-table";

interface DataTableFilterMenuProps<TData> {
  table: Table<TData>;
}

export function DataTableFilterMenu<TData>({
  table,
}: DataTableFilterMenuProps<TData>) {
  const router = useRouter();
  const [, startTransition] = React.useTransition();
  const [filters, setFilters] = useQueryState(
    "filters",
    filterItemParser.withOptions({ history: "push", shallow: false, startTransition }).withDefault([])
  );
  const [, setPage] = useQueryState(
    "page",
    parseAsInteger.withOptions({ history: "push", shallow: false, startTransition }).withDefault(1)
  );

  const [open, setOpen] = React.useState(false);
  const [selectedColumnId, setSelectedColumnId] = React.useState<string>("");
  const [operator, setOperator] = React.useState<FilterOperator>("iLike");
  const [value, setValue] = React.useState<string>("");

  const filterableColumns = table
    .getAllColumns()
    .filter((col) => col.getCanFilter());

  const selectedColumn = table.getColumn(selectedColumnId);
  const variant = selectedColumn?.columnDef.meta?.variant ?? "text";
  const options = selectedColumn?.columnDef.meta?.options ?? [];

  const handleAddFilter = () => {
    if (!selectedColumnId || !value) return;

    const existingIndex = filters.findIndex((f) => f.id === selectedColumnId);
    const newFilter = {
      id: selectedColumnId,
      value: variant === "multiSelect" ? value.split(",").map((s) => s.trim()) : value,
      operator,
    };

    let nextFilters = [...filters, newFilter];
    if (existingIndex >= 0) {
      const updated = [...filters];
      updated[existingIndex] = newFilter;
      nextFilters = updated;
    }

    void Promise.all([setFilters(nextFilters), setPage(1)])
      .then(() => router.refresh())
      .catch(() => undefined);

    setOpen(false);
    setValue("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5" />
            Filtro
          </Button>
        }
      />
      <PopoverContent align="start" className="w-[300px] p-3 space-y-3">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Coluna</label>
          <Select
            value={selectedColumnId}
            onValueChange={(val) => {
              setSelectedColumnId(val);
              const col = table.getColumn(val);
              const v = col?.columnDef.meta?.variant ?? "text";
              if (v === "select" || v === "multiSelect") {
                setOperator("inArray");
              } else {
                setOperator("iLike");
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione uma coluna" />
            </SelectTrigger>
            <SelectContent>
              {filterableColumns.map((col) => {
                const label = col.columnDef.meta?.label ?? col.id;
                return (
                  <SelectItem key={col.id} value={col.id} className="text-xs">
                    {label}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedColumnId && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Operador</label>
              <Select value={operator} onValueChange={(val) => setOperator(val as FilterOperator)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {variant === "select" || variant === "multiSelect" ? (
                    dataTableConfig.selectOperators.map((op) => (
                      <SelectItem key={op.value} value={op.value} className="text-xs">
                        {op.label}
                      </SelectItem>
                    ))
                  ) : (
                    dataTableConfig.textOperators.map((op) => (
                      <SelectItem key={op.value} value={op.value} className="text-xs">
                        {op.label}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Valor</label>
              {options.length > 0 ? (
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Escolha um valor" />
                  </SelectTrigger>
                  <SelectContent>
                    {options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-8 text-xs"
                  placeholder="Digite o valor..."
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddFilter();
                  }}
                />
              )}
            </div>

            <Button
              variant="default"
              size="sm"
              className="w-full h-8 text-xs gap-1.5 mt-2"
              onClick={handleAddFilter}
              disabled={!value}
            >
              <Plus className="h-3.5 w-3.5" />
              Aplicar Filtro
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
