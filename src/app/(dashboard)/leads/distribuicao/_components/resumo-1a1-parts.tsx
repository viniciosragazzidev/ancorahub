"use client";

/** Peças pequenas do Resumo 1:1 (artifact "Distribuição · Resumo"): seletores em pílula, páginas e ícones do desenho. */
import type { ReactNode } from "react";

import s from "./resumo-1a1.module.css";

export function ChevronDownIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} aria-hidden="true">
      <path d="m5 12 5 5 9-10" />
    </svg>
  );
}

type Option = { value: string; label: string };

/** Seletor em pílula do artifact (`.select`), com o menu nativo do sistema. */
export function PillSelect({ label, value, options, onChange, flat = false, name }: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  flat?: boolean;
  name?: string;
}) {
  return (
    <span className={`${s.select} ${flat ? s.selectFlat : ""}`}>
      <select aria-label={label} name={name} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDownIcon />
    </span>
  );
}

/** Seletor pequeno da linha (`.mini`): "Unidade" e "Corretor". */
export function MiniSelect({ label, placeholder, value, options, onChange, className }: {
  label: string;
  placeholder: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <span className={className ?? s.mini}>
      <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDownIcon size={12} />
    </span>
  );
}

/** Páginas numeradas do artifact (`.pg`): até cinco números em volta da atual. */
export function PageButtons({ page, totalPages, onPageChange, label, disabled = false }: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  label: string;
  disabled?: boolean;
}) {
  if (totalPages <= 1) return <nav aria-label={label} className={s.pages}><button type="button" className={s.pg} aria-current="page" disabled>1</button></nav>;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const numbers: ReactNode[] = [];
  for (let n = start; n <= end; n += 1) {
    numbers.push(
      <button key={n} type="button" className={s.pg} aria-current={n === page ? "page" : undefined} aria-label={`Página ${n}`}
        disabled={disabled} onClick={() => onPageChange(n)}>{n}</button>,
    );
  }
  return <nav aria-label={label} className={s.pages}>{numbers}</nav>;
}

export function initialsOf(name: string) {
  return name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}
