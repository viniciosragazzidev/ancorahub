"use client";

/**
 * Cabeçalho do painel do diretor no visual Lite (uma fonte só): saudação com o primeiro nome, data, seletor de
 * unidade, período em controle segmentado e as seções em controle segmentado. Usado pelo painel real (links e
 * `onUnit`) e pela prévia (`onTab`/`onPeriod` com estado).
 */
import Link from "next/link";

import styles from "./director-lite.module.css";
import { dateTitle } from "./format";

export type HeaderOption = { value: string; label: string; href: string };
export type HeaderUnit = { value: string; label: string };

function Segmented({ label, items, active, onSelect, kind }: { label: string; items: HeaderOption[]; active: string; onSelect?: (value: string) => void; kind: "period" | "tab" }) {
  return (
    <nav aria-label={label} className={styles.pills}>
      {items.map((item) => {
        const current = item.value === active;
        if (onSelect) {
          return (
            <button key={item.value} type="button" className={styles.pill} data-active={current ? "true" : undefined} aria-pressed={current} onClick={() => onSelect(item.value)}>
              {item.label}
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
          >
            {item.label}
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
  return (
    <header className={styles.headerBlock}>
      <div className={styles.pageHead}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>Olá, {firstName ?? "diretor"}</h1>
          <p className={styles.pageSubtitle}>{dateTitle(now)}. O dia da operação começa às 19h de ontem.</p>
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
          <Segmented label="Período" items={periods} active={activePeriod} onSelect={onPeriod} kind="period" />
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
