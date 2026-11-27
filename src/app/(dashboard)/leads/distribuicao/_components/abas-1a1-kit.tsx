"use client";

/**
 * Peças comuns das abas Entradas e regras, Filas e Saúde no Lite (27/11/2026), na linguagem do Resumo e de Plantões:
 * topo da aba com cartões de estado (o cartão com configuração abre a gaveta), seção em cartão, paginação e busca.
 */
import { useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { PlSheet, SearchIcon, pl } from "../plantao/_components/plantoes-1a1-kit";
import ab from "./abas-1a1.module.css";

export type Tab1a1Stat = {
  key: string;
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral";
  /** Valor em palavra ("Ligada"), num corpo menor que o de número. */
  text?: boolean;
  /** Configuração do bloco: o cartão abre a gaveta com ela. */
  panel?: ReactNode;
  panelDescription?: string;
};

const TONE: Record<string, string | undefined> = { success: ab.toneSuccess, warning: ab.toneWarning, danger: ab.toneDanger };

export function Tab1a1({ title, lead, stats, actions, children }: { title: string; lead: string; stats: Tab1a1Stat[]; actions?: ReactNode; children?: ReactNode }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const open = stats.find((stat) => stat.key === openKey && stat.panel) ?? null;
  return (
    <section className={ab.tab} aria-label={title}>
      <div className={cn(ab.head, pl.in)}>
        <div className={ab.headText}>
          <h2 className={ab.title}>{title}</h2>
          <p className={ab.lead}>{lead}</p>
        </div>
        {actions ? <div className={ab.headActions}>{actions}</div> : null}
      </div>
      <div className={cn(ab.stats, pl.in)} style={{ animationDelay: "80ms" }}>
        {stats.map((stat) => {
          const body = (
            <>
              <span className={ab.statLabel}>{stat.label}</span>
              <span className={cn(stat.text ? ab.statText : ab.statValue, stat.tone ? TONE[stat.tone] : undefined)}>
                {typeof stat.value === "number" ? stat.value.toLocaleString("pt-BR") : stat.value}
              </span>
              {stat.hint ? <span className={ab.statHint}>{stat.hint}</span> : null}
            </>
          );
          return stat.panel ? (
            <button key={stat.key} type="button" className={cn(pl.card, ab.stat)} onClick={() => setOpenKey(stat.key)} aria-haspopup="dialog">
              {body}
              <span className={ab.statFoot}>Ajustar</span>
            </button>
          ) : (
            <div key={stat.key} className={cn(pl.card, ab.stat)}>{body}</div>
          );
        })}
      </div>
      {children}
      <PlSheet open={Boolean(open)} onOpenChange={(next) => { if (!next) setOpenKey(null); }} title={open?.label ?? ""} description={open?.panelDescription} width={560}>
        <div className={ab.panelHost}>{open?.panel}</div>
      </PlSheet>
    </section>
  );
}

/** Seção em cartão: título de 16px, frase, ações à direita e o corpo. */
export function Section1a1({ title, count, lead, actions, children, delay = 120, id }: { title: ReactNode; count?: number; lead?: ReactNode; actions?: ReactNode; children: ReactNode; delay?: number; id?: string }) {
  return (
    <section className={cn(pl.card, pl.in, ab.section)} style={{ animationDelay: `${delay}ms` }} aria-labelledby={id}>
      <div className={ab.sectionHead}>
        <div className={ab.sectionText}>
          <h3 id={id} className={ab.h2}>{title}{typeof count === "number" ? <span className={cn(pl.badge, pl.num)}>{count.toLocaleString("pt-BR")}</span> : null}</h3>
          {lead ? <p className={ab.sectionLead}>{lead}</p> : null}
        </div>
        {actions ? <div className={ab.headActions}>{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Search1a1({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className={ab.search}>
      <SearchIcon />
      <span className={pl.srOnly}>{placeholder}</span>
      <input type="search" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

/** Página de N itens: devolve a fatia, o rodapé "1 a 20 de 54" e os botões. */
export function usePages1a1<T>(rows: T[], perPage = 20) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const current = Math.min(page, totalPages);
  const from = (current - 1) * perPage;
  return { pageRows: rows.slice(from, from + perPage), page: current, totalPages, setPage, from, to: Math.min(from + perPage, rows.length), total: rows.length };
}

export function Pager1a1({ page, totalPages, onPage, label }: { page: number; totalPages: number; onPage: (page: number) => void; label: string }) {
  if (totalPages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  const end = Math.min(totalPages, start + 4);
  const numbers: number[] = [];
  for (let n = start; n <= end; n += 1) numbers.push(n);
  return (
    <nav aria-label={label} className={ab.pager}>
      <button type="button" className={ab.pagerBtn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">‹</button>
      {numbers.map((n) => <button key={n} type="button" className={ab.pagerBtn} aria-current={n === page ? "page" : undefined} aria-label={`Página ${n}`} onClick={() => onPage(n)}>{n}</button>)}
      <button type="button" className={ab.pagerBtn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">›</button>
    </nav>
  );
}

export function TableFoot1a1({ pages, noun, label }: { pages: ReturnType<typeof usePages1a1<unknown>>; noun: string; label: string }) {
  if (pages.totalPages <= 1) return null;
  return (
    <div className={ab.foot}>
      <span>{pages.from + 1} a {pages.to} de {pages.total.toLocaleString("pt-BR")} {noun}</span>
      <Pager1a1 page={pages.page} totalPages={pages.totalPages} onPage={pages.setPage} label={label} />
    </div>
  );
}

/** Estilo das colunas da tabela (`--cols` e largura mínima). */
export function cols(template: string, min = 960): CSSProperties {
  return { ["--cols" as string]: template, ["--table-min" as string]: `${min}px` } as CSSProperties;
}

export { ab };
