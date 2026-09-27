"use client";

import { useMemo, useState, type ReactNode } from "react";

import { Loader2Icon, MagnifyingGlass, Plus } from "@/components/huge-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type SearchAddItem = {
  id: string;
  label: string;
  /** Second line under the label (status, owner, current destination…). */
  hint?: ReactNode;
  /** Small tag before the label, e.g. "Campanha" / "Anúncio". */
  tag?: ReactNode;
  /** Extra text matched by the search besides the label. */
  keywords?: string;
};

/**
 * Search box + result list with one "+" per row — the "type a name, click add"
 * pattern from the duty roster. Results only show while there is a query, so
 * the resting state is a single input.
 */
export function SearchAddList({
  items,
  onAdd,
  placeholder,
  emptyLabel = "Nada encontrado.",
  addingId,
  disabled,
  maxResults = 30,
  toolbar,
}: {
  items: SearchAddItem[];
  onAdd: (item: SearchAddItem) => void;
  placeholder: string;
  emptyLabel?: string;
  addingId?: string | null;
  disabled?: boolean;
  maxResults?: number;
  /** Controls next to the input (e.g. an "only active" switch). */
  toolbar?: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("pt-BR");
    if (!needle) return [];
    return items
      .filter((item) => `${item.label} ${item.keywords ?? ""}`.toLocaleLowerCase("pt-BR").includes(needle))
      .slice(0, maxResults);
  }, [items, query, maxResults]);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <div className="flex items-center gap-2">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">{placeholder}</span>
          <MagnifyingGlass
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="pl-8"
          />
        </label>
        {toolbar}
      </div>
      {query.trim() ? (
        <div className="rounded-lg border border-border/70 bg-card">
          {results.length ? (
            <ul className="max-h-60 divide-y divide-border/60 overflow-y-auto">
              {results.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                      {item.tag}
                      <span className="truncate">{item.label}</span>
                    </p>
                    {item.hint ? <p className="truncate text-[11px] text-muted-foreground">{item.hint}</p> : null}
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0"
                    aria-label={`Adicionar ${item.label}`}
                    title={`Adicionar ${item.label}`}
                    disabled={disabled || Boolean(addingId)}
                    onClick={() => onAdd(item)}
                  >
                    {addingId === item.id ? <Loader2Icon className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-2.5 text-xs text-muted-foreground">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
