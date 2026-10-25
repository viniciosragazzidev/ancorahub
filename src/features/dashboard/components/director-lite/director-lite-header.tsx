"use client";

/** Controles do painel do diretor no visual Lite: unidade, periodo e abas. */
import Link from "next/link";

import styles from "./director-lite.module.css";
import { dateTitle } from "./format";

function PeriodHelp() {
  return (
    <details className={styles.help}>
      <summary className={styles.helpButton} aria-label="Sobre o período" title="Sobre o período">?</summary>
      <ul className={styles.helpPanel}>
        <li>O período altera apenas os leads por fila.</li>
        <li>Plantões e WhatsApp mostram o momento atual.</li>
      </ul>
    </details>
  );
}

/** `short` é o rótulo do celular (abaixo de 640px); o `label` completo segue no aria-label e no computador. */
export type HeaderOption = { value: string; label: string; href: string; short?: string };
export type HeaderUnit = { value: string; label: string };

function Segmented({ label, items, active, onSelect, kind }: { label: string; items: HeaderOption[]; active: string; onSelect?: (value: string) => void; kind: "period" | "tab" }) {
  return (
    <nav aria-label={label} className={styles.pills}>
      {items.map((item) => {
        const current = item.value === active;
        // Dois rótulos no DOM: o completo (computador) e o curto (celular), trocados por CSS; o nome acessível é o completo.
        const text = (
          <>
            <span className={styles.labelFull}>{item.label}</span>
            <span className={styles.labelShort} aria-hidden="true">{item.short ?? item.label}</span>
          </>
        );
        if (onSelect) {
          return (
            <button key={item.value} type="button" className={styles.pill} data-active={current ? "true" : undefined} aria-pressed={current} aria-label={item.label} onClick={() => onSelect(item.value)}>
              {text}
            </button>
          );
        }
        return (
          <Link
            key={item.value}
            href={item.href}
            className={styles.pill}
            data-active={current ? "true" : undefined}
            aria-current={current ? (kind === "tab" ? "page" : "true") : undefined}
            aria-label={item.label}
          >
            {text}
          </Link>
        );
      })}
    </nav>
  );
}

export function DirectorLiteHeader({ firstName, now, tabs, activeTab, onTab, periods, activePeriod, onPeriod, units, activeUnit, onUnit }: {
  firstName: string | null;
  now: Date;
  tabs: HeaderOption[];
  activeTab: string;
  /** Na prévia, troca a seção com estado; no painel real, os links fazem a navegação. */
  onTab?: (value: string) => void;
  periods: HeaderOption[];
  activePeriod: string;
  onPeriod?: (value: string) => void;
  /** Sem `units` (ou vazio) o seletor some: sem permissão de comparar unidades. */
  units?: HeaderUnit[];
  activeUnit: string;
  onUnit?: (value: string) => void;
}) {
  const shortDate = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "numeric", month: "short" }).format(now);

  return (
    <header className={styles.headerBlock}>
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <p className={styles.pageSubtitle} title={`${dateTitle(now)}. O dia da operação começa às 19h.`}>Olá, {firstName ?? "diretor"} · {shortDate} · dia começa às 19h</p>
        </div>
        <div className={styles.filters}>
          {units && units.length > 0 ? (
            <label className={styles.unitPick}>
              <span className={styles.srOnly}>Unidade</span>
              <select className={styles.unitSelect} value={activeUnit} onChange={(event) => onUnit?.(event.target.value)} disabled={!onUnit}>
                {units.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={styles.periodGroup}>
            <Segmented label="Período" items={periods} active={activePeriod} onSelect={onPeriod} kind="period" />
            <PeriodHelp />
          </div>
        </div>
      </div>
      {tabs.length ? (
        <div className={styles.tabsRow}>
          <Segmented label="Abas do painel" items={tabs} active={activeTab} onSelect={onTab} kind="tab" />
        </div>
      ) : null}
    </header>
  );
}
