"use client";

/**
 * Peças das gavetas de configuração da /distribuicao no Lite (27/11/2026): linha com interruptor, aviso, rodapé fixo
 * com a ação principal e a linha em pílula. Mesma linguagem do kit de Plantões (`pl.*`) e da gaveta de leads frios.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { pl } from "../plantao/_components/plantoes-1a1-kit";
import pn from "./panels-1a1.module.css";

/** Raiz de um painel dentro da gaveta: tokens do Lite e o espaçamento das seções. */
export function Panel1a1({ children, lead }: { children: ReactNode; lead?: ReactNode }) {
  return (
    <div className={cn(pl.gx, pn.panel)}>
      {lead ? <p className={pl.small}>{lead}</p> : null}
      {children}
    </div>
  );
}

/** Cartão com título, explicação e o interruptor Arc (índigo) à direita: o texto e o interruptor leem o mesmo valor. */
export function ToggleRow1a1({ title, hint, checked, onChange, disabled, ariaLabel, status }: {
  title: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  ariaLabel: string;
  /** Selo do estado atual ("Ligada" / "Desligada"), sempre do mesmo valor do interruptor. */
  status?: { on: string; off: string };
}) {
  return (
    <div className={pn.toggle}>
      <div className={pn.toggleText}>
        <p className={pn.toggleTitle}>
          {title}
          {status ? <span className={cn(pl.badge, checked ? pl.bGood : undefined)}>{checked ? status.on : status.off}</span> : null}
        </p>
        {hint ? <p className={pl.small}>{hint}</p> : null}
      </div>
      <button type="button" role="switch" aria-checked={checked} aria-label={ariaLabel} className={pl.sw} disabled={disabled} onClick={() => onChange(!checked)} />
    </div>
  );
}

/** Aviso discreto (informação, não status). */
export function Note1a1({ children, tone }: { children: ReactNode; tone?: "warning" }) {
  return <p className={cn(pn.note, tone === "warning" && pn.noteWarning)}>{children}</p>;
}

/** Rodapé fixo no fim da gaveta: texto à esquerda e a ação principal à direita. */
export function Foot1a1({ children, note }: { children?: ReactNode; note?: ReactNode }) {
  return (
    <div className={pn.foot}>
      <span className={cn(pl.small, pn.footNote)}>{note}</span>
      {children ? <div className={pn.footActions}>{children}</div> : null}
    </div>
  );
}

/** Linha em pílula: título, meta e o que vier à direita. */
export function Row1a1({ title, meta, aside, lead }: { title: ReactNode; meta?: ReactNode; aside?: ReactNode; lead?: ReactNode }) {
  return (
    <div className={pn.row}>
      {lead}
      <span className={pn.rowBody}><span className={pn.rowTitle}>{title}</span>{meta ? <span className={pn.rowMeta}>{meta}</span> : null}</span>
      {aside ? <span className={pn.rowAside}>{aside}</span> : null}
    </div>
  );
}

/** Opções em pílulas (presets de minutos, por exemplo): a escolhida em índigo. */
export function Chips1a1<T extends string | number>({ value, options, onChange, disabled, label }: {
  value: T;
  options: ReadonlyArray<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className={pn.chips} role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={String(option.value)} type="button" role="radio" aria-checked={value === option.value} className={pn.chip} disabled={disabled} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { pn };
