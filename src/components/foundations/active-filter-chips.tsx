"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterChipItem {
  id: string;
  label: string;
  value: string;
}

export interface ActiveFilterChipsProps {
  chips: FilterChipItem[];
  onRemoveChip: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function ActiveFilterChips({
  chips,
  onRemoveChip,
  onClearAll,
  className,
}: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div
      data-slot="canonical-active-filter-chips"
      className={cn("flex flex-wrap items-center gap-1.5 pt-1", className)}
    >
      <span className="text-[11px] font-medium text-muted-foreground mr-1">
        Filtros ativos:
      </span>

      {chips.map((chip) => (
        <Badge
          key={chip.id}
          variant="secondary"
          className="group flex items-center gap-1.5 py-0.5 pl-2 pr-1 text-[11px] font-medium border border-border/60 bg-muted/60"
        >
          <span>
            <strong className="font-semibold text-foreground/80">{chip.label}:</strong> {chip.value}
          </span>
          <button
            type="button"
            onClick={() => onRemoveChip(chip.id)}
            aria-label={`Remover filtro ${chip.label}: ${chip.value}`}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}

      {onClearAll && chips.length > 1 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Limpar todos
        </Button>
      )}
    </div>
  );
}
