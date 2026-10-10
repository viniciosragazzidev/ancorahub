"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";

import { searchAssist, type AssistCapability, type AssistEntry } from "../catalog";
import styles from "./assist.module.css";

const ICON = {
  screen: "M4 5h16v14H4zM4 9h16",
  action: "M13 2 4 14h7l-1 8 9-12h-7z",
} as const;

/** One recognizable icon per entry; anything new falls back to its kind. */
const ENTRY_ICON: Record<string, string> = {
  home: "M3 11l9-7 9 7v9H4zM9 20v-6h6v6",
  queue: "M4 6h16M4 12h16M4 18h10",
  leads: "M16 20v-2a4 4 0 0 0-8 0v2M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  clients: "M5 12l4 4 10-10",
  journey: "M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1-5.4 3.1 1.3-6L3.3 9.2l6.1-.6z",
  ledger: "M5 4h11l3 3v13H5zM9 10h6M9 14h6",
  duty: "M7 3v3M17 3v3M4 8h16M5 5h14v15H5z",
  quote: "M5 4h14v16H5zM8 8h8M8 12h3M13 12h3M8 16h3M13 16h3",
  mural: "M4 5h16v11H8l-4 4z",
  notifications: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2M18 12h2M12 4v2M12 18v2",
  pause: "M9 5v14M15 5v14",
  availability: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  whatsapp: "M4 20l1.5-4A8 8 0 1 1 8 18.5z",
  photo: "M4 7h4l2-2h4l2 2h4v12H4zM12 16a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  password: "M6 11h12v9H6zM9 11V8a3 3 0 0 1 6 0v3",
  "board-privacy": "M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6zM4 4l16 16",
  tour: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 9l5 3-5 3z",
  "register-contact": "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  "change-step": "M4 6h4v4H4zM10 8h10M4 14h4v4H4zM10 16h10",
  "schedule-return": "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5",
};

/**
 * "Onde fica?": one search for screens and actions, in the broker's words.
 * Combobox pattern: arrows move, Enter opens, Esc closes; results are read
 * by screen readers as they change. Opens with "/" or Ctrl+K on computers.
 */
export function AssistSearch({ open, onOpenChange, capabilities }: { open: boolean; onOpenChange: (open: boolean) => void; capabilities: Partial<Record<AssistCapability, boolean>> }) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  // Shown and navigated in the same order: actions first (what to do), then screens.
  const results = useMemo(() => {
    const found = searchAssist(query, capabilities);
    return [...found.filter((entry) => entry.kind === "action"), ...found.filter((entry) => entry.kind === "screen")];
  }, [query, capabilities]);
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(timer);
  }, [open]);

  function go(entry: AssistEntry) {
    onOpenChange(false);
    setQuery("");
    router.push(entry.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((index) => Math.min(results.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive((index) => Math.max(0, index - 1)); }
    else if (event.key === "Enter" && results[activeIndex]) { event.preventDefault(); go(results[activeIndex]); }
  }

  const screens = results.filter((entry) => entry.kind === "screen");
  const actions = results.filter((entry) => entry.kind === "action");
  const optionId = (entry: AssistEntry) => `${listId}-${entry.id}`;
  const renderGroup = (label: string, entries: AssistEntry[]) => entries.length ? (
    <li role="presentation" className={styles.group}>
      <span className={styles.groupLabel} id={`${listId}-${label}`}>{label}</span>
      <ul role="group" aria-labelledby={`${listId}-${label}`} className={styles.options}>
        {entries.map((entry) => {
          const index = results.indexOf(entry);
          return (
            <li key={entry.id} id={optionId(entry)} role="option" aria-selected={index === activeIndex} className={styles.option} onMouseEnter={() => setActive(index)} onClick={() => go(entry)}>
              <span className={styles.optionIcon} data-kind={entry.kind} aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={ENTRY_ICON[entry.id] ?? ICON[entry.kind]} /></svg>
              </span>
              <span className={styles.optionText}><strong>{entry.title}</strong><small>{entry.description}</small></span>
              <svg className={styles.optionGo} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </li>
          );
        })}
      </ul>
    </li>
  ) : null;

  return (
    <BottomSheet className="arc-venancor" open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) setQuery(""); }} title="Onde fica?" description="Escreva do seu jeito: pausar, pontos, WhatsApp, retorno..." detents={[0.92]} closeLabel="Fechar">
      <div className={styles.search}>
        <div className={styles.inputWrap}>
          <svg className={styles.inputIcon} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
          <input
            ref={inputRef}
            type="search"
            className={styles.input}
            value={query}
            onChange={(event) => { setQuery(event.currentTarget.value); setActive(0); }}
            onKeyDown={onKeyDown}
            placeholder="O que você procura?"
            role="combobox"
            aria-label="O que você procura?"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={results[activeIndex] ? optionId(results[activeIndex]) : undefined}
            autoComplete="off"
            enterKeyHint="go"
          />
        </div>
        <p className={styles.srOnly} role="status" aria-live="polite">{query ? (results.length ? `${results.length} resultado${results.length === 1 ? "" : "s"}` : "Nada encontrado") : ""}</p>
        {results.length ? (
          <ul id={listId} role="listbox" aria-label="Resultados" className={styles.results}>
            {renderGroup("Ações", actions)}
            {renderGroup("Telas", screens)}
          </ul>
        ) : (
          <div className={styles.none}>
            <strong>Não achei &quot;{query}&quot;</strong>
            <span>Tente outra palavra, ou pergunte para a Âncora no Início.</span>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
