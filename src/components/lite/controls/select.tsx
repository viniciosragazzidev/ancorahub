"use client";

/**
 * Seleção Lite com busca (F3): `LiteSelect` escolhe um valor de uma lista. No desktop a lista abre num popover ancorado
 * no campo; no celular (abaixo de 768px), no BottomSheet do Arc. `inline` abre a lista no próprio fluxo (para usar
 * dentro de um painel que já é uma folha). Teclado: setas, Home, End, Enter escolhe, Esc fecha e devolve o foco.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search } from "lucide-react";

import { BottomSheet } from "@/components/arc/bottom-sheet/bottom-sheet";

import styles from "./select.module.css";

export type LiteOption = { value: string; label: string; /** Contagem ao lado do rótulo (ex.: leads da fila). */ count?: number };

const PHONE_QUERY = "(max-width: 767px)";

/** Largura de celular, segura sem `matchMedia` (servidor e testes): sem suporte, conta como desktop. */
export function useLitePhone() {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
    const query = window.matchMedia(PHONE_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  const getSnapshot = useCallback(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(PHONE_QUERY).matches, []);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** Tira acentos e caixa para a busca achar "filial" em "Filial" e "niteroi" em "Niterói". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type LiteSelectProps = {
  /** Rótulo visível do campo (sentence case). */
  label: string;
  value: string;
  options: LiteOption[];
  onChange: (value: string) => void;
  /** Texto do campo sem valor que case com uma opção. */
  placeholder?: string;
  searchPlaceholder?: string;
  /** Abre a lista no fluxo, sem popover nem folha. */
  inline?: boolean;
  /** Esconde o rótulo visível (o campo continua nomeado por ele). */
  hideLabel?: boolean;
};

export function LiteSelect({ label, value, options, onChange, placeholder = "Selecione", searchPlaceholder = "Buscar", inline = false, hideLabel = false }: LiteSelectProps) {
  const [open, setOpen] = useState(false);
  const phone = useLitePhone();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const valueId = useId();
  const panelId = useId();
  const selected = options.find((option) => option.value === value);
  const mode: "inline" | "sheet" | "popover" = inline ? "inline" : phone ? "sheet" : "popover";

  const close = useCallback((returnFocus: boolean) => {
    setOpen(false);
    if (returnFocus) window.setTimeout(() => triggerRef.current?.focus(), 0);
  }, []);

  // Popover e lista no fluxo: clique fora fecha sem escolher.
  useEffect(() => {
    if (!open || mode === "sheet") return;
    const onPointer = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open, mode]);

  const choose = (next: string) => {
    onChange(next);
    close(true);
  };

  const panel = (
    <OptionPanel
      id={panelId}
      label={label}
      options={options}
      value={value}
      searchPlaceholder={searchPlaceholder}
      onChoose={choose}
      onDismiss={() => close(true)}
    />
  );

  return (
    <div ref={wrapRef} className={styles.field}>
      <span id={labelId} className={hideLabel ? styles.srOnly : styles.label}>{label}</span>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open && mode !== "sheet" ? panelId : undefined}
        aria-labelledby={`${labelId} ${valueId}`}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={valueId} className={selected ? styles.value : styles.placeholder}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden="true" size={16} className={styles.chevron} />
      </button>
      {mode === "sheet" ? (
        <BottomSheet open={open} onOpenChange={(next) => (next ? setOpen(true) : close(true))} title={label} closeLabel="Fechar" detents={[0.6, 0.92]}>
          {open ? panel : null}
        </BottomSheet>
      ) : open ? (
        <div className={mode === "inline" ? styles.inlinePanel : styles.popover}>{panel}</div>
      ) : null}
    </div>
  );
}

/** Busca e lista de opções: o foco fica na busca e as setas movem a opção ativa (aria-activedescendant). */
function OptionPanel({ id, label, options, value, searchPlaceholder, onChoose, onDismiss }: {
  id: string;
  label: string;
  options: LiteOption[];
  value: string;
  searchPlaceholder: string;
  onChoose: (value: string) => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState("");
  const listId = useId();
  const optionPrefix = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    return needle ? options.filter((option) => normalize(option.label).includes(needle)) : options;
  }, [options, query]);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((option) => option.value === value)));
  const activeIndex = filtered.length ? Math.min(active, filtered.length - 1) : -1;

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (activeIndex < 0) return;
    document.getElementById(`${optionPrefix}-${activeIndex}`)?.scrollIntoView?.({ block: "nearest" });
  }, [activeIndex, optionPrefix]);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(filtered.length ? (activeIndex + 1) % filtered.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(filtered.length ? (activeIndex - 1 + filtered.length) % filtered.length : 0);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, filtered.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[activeIndex];
      if (option) onChoose(option.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onDismiss();
    } else if (event.key === "Tab") {
      onDismiss();
    }
  };

  return (
    <div id={id} className={styles.panel}>
      <div className={styles.search}>
        <Search aria-hidden="true" size={16} className={styles.searchIcon} />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={`Buscar em ${label.toLowerCase()}`}
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `${optionPrefix}-${activeIndex}` : undefined}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className={styles.searchInput}
        />
      </div>
      <ul id={listId} role="listbox" aria-label={label} className={styles.list}>
        {filtered.map((option, index) => {
          const isSelected = option.value === value;
          return (
            <li
              key={option.value || "__all"}
              id={`${optionPrefix}-${index}`}
              role="option"
              aria-selected={isSelected}
              data-active={index === activeIndex ? "true" : undefined}
              className={styles.option}
              onPointerMove={() => setActive(index)}
              onClick={() => onChoose(option.value)}
            >
              <span className={styles.optionLabel}>{option.label}</span>
              {option.count !== undefined ? <span className={styles.optionCount}>{option.count.toLocaleString("pt-BR")}</span> : null}
              {isSelected ? <Check aria-hidden="true" size={16} className={styles.check} /> : null}
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? <p className={styles.empty} role="status">Nenhuma opção encontrada</p> : null}
    </div>
  );
}
