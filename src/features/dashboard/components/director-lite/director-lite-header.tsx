"use client";

/** Controles do painel do diretor no visual Lite: unidade, periodo e abas. */
import Link from "next/link";

import styles from "./director-lite.module.css";
import { customRangeLabel, type CustomRange } from "./custom-range";
import { dateTitle } from "./format";

function PeriodHelp() {
  return (
    <details className={styles.help}>
      <summary className={styles.helpButton} aria-label="Sobre o período" title="Sobre o período">?</summary>
      <ul className={styles.helpPanel}>
        <li>O dia da operação começa às 19h.</li>
        <li>O período altera apenas os leads por fila.</li>
        <li>Plantões e WhatsApp mostram o momento atual.</li>
      </ul>
    </details>
  );
}


/**
 * Intervalo personalizado com data e hora (como na tela antiga, 20/11/2026). Sem hora, "de" começa às 19h do dia
 * anterior e "até" termina às 19h, a mesma regra de `leadQualityRange`.
 */
function CustomRangePicker({ active, onApply }: { active: CustomRange | null; onApply: (range: CustomRange) => void }) {
  return (
    <details className={styles.help}>
      <summary className={styles.pill} data-active={active ? "true" : undefined} aria-label="Intervalo personalizado">
        {active ? customRangeLabel(active) : "Personalizado"}
      </summary>
      <form
        className={`${styles.helpPanel} ${styles.rangeForm}`}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const read = (name: string) => String(data.get(name) ?? "").trim();
          if (!read("from") || !read("to")) return;
          onApply({ from: read("from"), fromTime: read("fromTime") || null, to: read("to"), toTime: read("toTime") || null });
        }}
      >
        <p className={styles.rangeTitle}>Intervalo personalizado</p>
        <label className={styles.rangeField}>De<input type="date" name="from" required defaultValue={active?.from} /></label>
        <label className={styles.rangeField}>Hora<input type="time" name="fromTime" defaultValue={active?.fromTime ?? ""} /></label>
        <label className={styles.rangeField}>Até<input type="date" name="to" required defaultValue={active?.to} /></label>
        <label className={styles.rangeField}>Hora<input type="time" name="toTime" defaultValue={active?.toTime ?? ""} /></label>
        <p className={styles.rangeHint}>Sem hora, o dia começa às 19h do dia anterior e termina às 19h.</p>
        <button type="submit" className={styles.rangeApply}>Aplicar</button>
      </form>
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

export function DirectorLiteHeader({ firstName, now, tabs, activeTab, onTab, periods, activePeriod, onPeriod, units, activeUnit, onUnit, unitLabel = "Unidade", customRange, onCustomRange }: {
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
  /** Nome acessível do seletor ("Unidade" ou "Fila"). */
  unitLabel?: string;
  /** Intervalo personalizado ativo (nenhum atalho fica marcado) e a ação de aplicar um novo. Sem `onCustomRange`, some. */
  customRange?: CustomRange | null;
  onCustomRange?: (range: CustomRange) => void;
}) {
  // 20/11/2026 (skill interface-enxuta): uma faixa só. Abas à esquerda, unidade e período à direita; a saudação saiu
  // (o topo já diz "Painel · Hoje · unidade") e o início do dia fica no texto de ajuda do período.
  void firstName;
  return (
    <header className={styles.headerBlock}>
      <div className={styles.pageHead}>
        <div className={styles.titleBlock} title={`${dateTitle(now)}. O dia da operação começa às 19h.`}>
          {tabs.length ? <Segmented label="Abas do painel" items={tabs} active={activeTab} onSelect={onTab} kind="tab" /> : null}
        </div>
        <div className={styles.filters}>
          {units && units.length > 0 ? (
            <label className={styles.unitPick}>
              <span className={styles.srOnly}>{unitLabel}</span>
              <select className={styles.unitSelect} value={activeUnit} onChange={(event) => onUnit?.(event.target.value)} disabled={!onUnit}>
                {units.map((unit) => (
                  <option key={unit.value} value={unit.value}>{unit.label}</option>
                ))}
              </select>
            </label>
          ) : null}
          <div className={styles.periodGroup}>
            <Segmented label="Período" items={periods} active={activePeriod} onSelect={onPeriod} kind="period" />
            {onCustomRange ? <CustomRangePicker active={customRange ?? null} onApply={onCustomRange} /> : null}
            <PeriodHelp />
          </div>
        </div>
      </div>
    </header>
  );
}
