"use client";
import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { SearchAddList, type SearchAddItem } from "@/components/ui/search-add-list";
import type { ErpReadResult } from "../finance-actions";

const SEARCH_DELAY_MS = 250;
const MIN_QUERY = 2;

export type PickedRecord = { id: string; label: string; hint?: string };

/**
 * Server search + "+" to pick one record (sale, beneficiary). The chosen id goes in a hidden input named `name`.
 * SearchAddList keeps its own query; the wrapper listens to its input change to ask the server (debounced, latest wins).
 */
export function ServerSearchPick<T>({ name, label, placeholder, value, onChange, search, toRecord, disabled }: {
  name: string;
  label: string;
  placeholder: string;
  value: PickedRecord | null;
  onChange: (record: PickedRecord | null, row: T | null) => void;
  search: (query: string) => Promise<ErpReadResult<T[]>>;
  toRecord: (row: T) => PickedRecord;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<T[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);

  function onQuery(event: ChangeEvent<HTMLDivElement>) {
    const query = (event.target as unknown as HTMLInputElement).value?.trim() ?? "";
    if (timer.current) clearTimeout(timer.current);
    if (query.length < MIN_QUERY) {
      setRows([]);
      setMessage(query ? "Digite pelo menos 2 letras." : null);
      return;
    }
    const ticket = latest.current + 1;
    latest.current = ticket;
    timer.current = setTimeout(async () => {
      const result = await search(query);
      if (ticket !== latest.current) return;
      setRows(result.ok ? result.data : []);
      setMessage(result.ok ? null : result.message);
    }, SEARCH_DELAY_MS);
  }

  if (value) {
    return <div className="flex items-center justify-between gap-2">
      <input type="hidden" name={name} value={value.id} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{value.label}</p>
        {value.hint ? <p className="truncate text-xs text-muted-foreground">{value.hint}</p> : null}
      </div>
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null, null)}>Trocar</Button>
    </div>;
  }

  const records = rows.map((row) => ({ row, record: toRecord(row) }));
  const items: SearchAddItem[] = records.map(({ record }) => ({ id: record.id, label: record.label, hint: record.hint }));
  return <div onChange={onQuery} aria-label={label} role="group">
    <input type="hidden" name={name} value="" />
    <SearchAddList
      items={items}
      placeholder={placeholder}
      disabled={disabled}
      emptyLabel={message ?? "Nada encontrado no seu escopo."}
      maxResults={20}
      onAdd={(item) => {
        const match = records.find(({ record }) => record.id === item.id);
        if (match) onChange(match.record, match.row);
      }}
    />
  </div>;
}
