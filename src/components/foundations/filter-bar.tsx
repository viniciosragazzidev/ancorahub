"use client";

import * as React from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  quickFilters?: React.ReactNode;
  advancedFiltersTrigger?: {
    activeCount?: number;
    onClick: () => void;
  };
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
  children?: React.ReactNode;
  className?: string;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Buscar...",
  searchLabel = "Buscar",
  quickFilters,
  advancedFiltersTrigger,
  onClearFilters,
  hasActiveFilters,
  children,
  className,
}: FilterBarProps) {
  return (
    <div
      data-slot="canonical-filter-bar"
      className={cn(
        "flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {onSearchChange !== undefined && (
          <div className="relative min-w-[12rem] max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={searchValue ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchLabel}
              className="pl-8.5 pr-8 bg-background"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Limpar campo de busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {quickFilters}

        {advancedFiltersTrigger && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={advancedFiltersTrigger.onClick}
            className="gap-1.5 font-medium"
          >
            <SlidersHorizontal className="size-3.5 text-muted-foreground" />
            <span>Filtros</span>
            {Boolean(advancedFiltersTrigger.activeCount && advancedFiltersTrigger.activeCount > 0) && (
              <Badge
                variant="secondary"
                className="ml-0.5 px-1.5 py-0 text-[10px] font-bold"
              >
                {advancedFiltersTrigger.activeCount}
              </Badge>
            )}
          </Button>
        )}

        {hasActiveFilters && onClearFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Limpar tudo
          </Button>
        )}
      </div>

      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}
