"use client";

/**
 * Peças da área Comercial no Lite (28/11/2026, artifact "Comercial"): moldura da página com título, resumo, ações e
 * as abas da área (as mesmas do menu, pelo nav-registry e pelas mesmas permissões), faixa de números, abas de filtro
 * e páginas. As telas importam só os componentes; as classes ficam aqui, no cliente.
 */
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { useNavFlags, useNavUser } from "@/components/navigation/nav-access";
import { cn } from "@/lib/utils";
import { navRowTabs, resolveNavLocation } from "@/shared/navigation/nav-registry";

import s from "./comercial-1a1.module.css";

export { s as cm };

/** Abas da área Comercial em pílula (some com uma aba só, como a barra de abas de hoje). */
export function ComercialViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { negotiationsEnabled, postSaleAuditEnabled, autoSaleEnabled, erpPaths, initialUser, previewPathname } = useNavFlags();
  const user = useNavUser(initialUser);
  const location = previewPathname ? resolveNavLocation(previewPathname) : resolveNavLocation(pathname, searchParams);
  if (!location || !user) return null;
  const tabs = navRowTabs(location.area, { ...user, negotiationsEnabled, postSaleAuditEnabled, autoSaleEnabled, erpPaths }, location.tab.id);
  if (tabs.length < 2) return null;
  return (
    <nav className={s.views} aria-label={`Seções de ${location.area.label}`}>
      {tabs.map((tab) => (
        <Link key={tab.id} href={tab.href} className={s.view} aria-current={tab.id === location.tab.id ? "page" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}

/** Moldura da página: título, resumo e ações em cima, as abas da área e o conteúdo. */
export function ComercialPage({ title, summary, actions, children }: { title: string; summary?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <main className={cn("arc-venancor", s.gx, s.main)} data-skin="diretor">
      <div className={s.head}>
        <div>
          <h1 className={s.h1}>{title}</h1>
          {summary ? <p className={s.sum}>{summary}</p> : null}
        </div>
        {actions ? <div className={s.headActions}>{actions}</div> : null}
      </div>
      <ComercialViews />
      {children}
    </main>
  );
}

export type StripItem = { label: string; value: ReactNode; detail?: ReactNode };

/** Os números de resumo numa faixa só (direção limpa: um cartão, divisórias finas). */
export function StatStrip({ items, label = "Resumo" }: { items: StripItem[]; label?: string }) {
  return (
    <section className={cn(s.card, s.strip)} aria-label={label} style={items.length !== 4 ? { gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` } : undefined}>
      {items.map((item) => (
        <div key={item.label} className={s.stat}>
          <p className={s.sl}>{item.label}</p>
          <p className={s.sv}>{item.value}</p>
          {item.detail ? <p className={s.sd}>{item.detail}</p> : null}
        </div>
      ))}
    </section>
  );
}

/** Abas de filtro com contagem, sublinhadas. */
export function FilterTabs<T extends string>({ value, onChange, items, label }: { value: T; onChange: (value: T) => void; items: Array<{ value: T; label: string; count?: number }>; label: string }) {
  return (
    <div className={s.tabs} role="group" aria-label={label}>
      {items.map((item) => (
        <button key={item.value} type="button" className={s.tab} aria-pressed={value === item.value} onClick={() => onChange(item.value)}>
          {item.label}{typeof item.count === "number" ? <span className={s.tabCount}>{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Rodapé da lista: "1 a 10 de N" e as páginas (anterior, até 5 números, próxima). */
export function ListFoot({ page, totalPages, total, pageSize, noun, onPage, label }: { page: number; totalPages: number; total: number; pageSize: number; noun: string; onPage: (page: number) => void; label: string }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const numbers: number[] = [];
  for (let n = start; n <= end; n += 1) numbers.push(n);
  return (
    <div className={s.foot}>
      <span>{from} a {to} de {total} {noun}</span>
      {totalPages > 1 ? (
        <nav className={s.pager} aria-label={label}>
          <button type="button" className={s.pg} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">‹</button>
          {numbers.map((n) => <button key={n} type="button" className={s.pg} aria-current={n === page ? "page" : undefined} aria-label={`Página ${n}`} onClick={() => onPage(n)}>{n}</button>)}
          <button type="button" className={s.pg} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">›</button>
        </nav>
      ) : null}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return (
    <label className={s.search}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} aria-label={label} />
    </label>
  );
}
