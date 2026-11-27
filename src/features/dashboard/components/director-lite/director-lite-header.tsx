"use client";

/**
 * Topo do painel da gestão no visual Lite. Desde 27/11/2026, o desenho aprovado no artifact "Painel da gestão no
 * estilo do corretor": abas com ícone em cima; a saudação com uma frase da situação; à direita, a ação do momento
 * ("Precisa de você"), o período, o calendário do intervalo personalizado e a unidade ou fila.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { CalendarDays, Filter, LayoutGrid, Star } from "lucide-react";
import { useLitePhone } from "@/components/lite/controls/select";

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
 * Calendário do período. No computador abre o intervalo personalizado com data e hora (como na tela antiga, 20/11/2026;
 * sem hora, "de" começa às 19h do dia anterior e "até" termina às 19h, a regra de `leadQualityRange`). No celular
 * (27/11/2026) é a única porta do período: abre também os atalhos Hoje, 7 dias e 30 dias e a unidade ou fila, que
 * saem da tela para ficarem visíveis só as abas.
 */
function PeriodCalendar({ active, onApply, periods, activePeriod, onPeriod, unitPicker, phone }: {
  phone: boolean;
  active: CustomRange | null;
  onApply?: (range: CustomRange) => void;
  periods: HeaderOption[];
  activePeriod: string;
  onPeriod?: (value: string) => void;
  unitPicker: ReactNode;
}) {
  return (
    <details className={styles.help} data-desktop={onApply ? undefined : "hidden"}>
      <summary className={styles.calendarButton} data-active={active ? "true" : undefined} aria-label={active ? `Período: ${customRangeLabel(active)}` : "Escolher o período"} title={active ? customRangeLabel(active) : "Período"}>
        <CalendarDays aria-hidden="true" size={18} />
      </summary>
      <div className={`${styles.helpPanel} ${styles.calendarPanel}`}>
        {phone ? (
          <div className={styles.phoneOnly}>
            <p className={styles.rangeTitle}>Período</p>
            <Segmented label="Período" items={periods} active={activePeriod} onSelect={onPeriod} kind="period" />
            {unitPicker}
          </div>
        ) : null}
        {onApply ? (
          <form
            className={styles.rangeForm}
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
        ) : null}
      </div>
    </details>
  );
}

/** `short` é o rótulo do celular (abaixo de 640px); o `label` completo segue no aria-label e no computador. */
export type HeaderOption = { value: string; label: string; href: string; short?: string };

const TAB_ICONS: Record<string, typeof LayoutGrid> = { overview: LayoutGrid, quality: Star, funnel: Filter };

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}
export type HeaderUnit = { value: string; label: string };

function Segmented({ label, items, active, onSelect, kind }: { label: string; items: HeaderOption[]; active: string; onSelect?: (value: string) => void; kind: "period" | "tab" }) {
  return (
    <nav aria-label={label} className={styles.pills}>
      {items.map((item) => {
        const current = item.value === active;
        // Dois rótulos no DOM: o completo (computador) e o curto (celular), trocados por CSS; o nome acessível é o completo.
        const Icon = kind === "tab" ? TAB_ICONS[item.value] : null;
        const text = (
          <>
            {Icon ? <Icon aria-hidden="true" size={16} className={styles.tabIcon} /> : null}
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

export function DirectorLiteHeader({ firstName, now, tabs, activeTab, onTab, periods, activePeriod, onPeriod, units, activeUnit, onUnit, unitLabel = "Unidade", customRange, onCustomRange, headline, action }: {
  firstName: string | null;
  /** Uma frase com a situação, logo abaixo da saudação ("Hoje entraram 86 leads."). */
  headline?: string | null;
  /** A ação do momento, antes do período (o botão "Precisa de você" da visão geral). */
  action?: ReactNode;
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
  // Celular (27/11/2026): período e unidade saem do topo e abrem no calendário; ficam à vista só as abas.
  const phone = useLitePhone();
  const unitPicker = units && units.length > 0 ? (
    <label className={styles.unitPick}>
      <span className={styles.srOnly}>{unitLabel}</span>
      <select className={styles.unitSelect} value={activeUnit} onChange={(event) => onUnit?.(event.target.value)} disabled={!onUnit}>
        {units.map((unit) => (
          <option key={unit.value} value={unit.value}>{unit.label}</option>
        ))}
      </select>
    </label>
  ) : null;
  return (
    <header className={`${styles.headerBlock} ${styles.headerV2}`}>
      {tabs.length ? (
        <div className={styles.viewTabs} title={`${dateTitle(now)}. O dia da operação começa às 19h.`}>
          <Segmented label="Seções do painel" items={tabs} active={activeTab} onSelect={onTab} kind="tab" />
        </div>
      ) : null}
      <div className={styles.pageHead}>
        <div className={styles.greetingBlock}>
          <h1 className={styles.greetingTitle}>{greeting(now)}{firstName ? `, ${firstName}` : ""}</h1>
          {headline ? <p className={styles.greetingText}>{headline}</p> : null}
        </div>
        <div className={styles.filters}>
          {action}
          <div className={styles.periodGroup}>
            {phone ? null : <Segmented label="Período" items={periods} active={activePeriod} onSelect={onPeriod} kind="period" />}
            {phone && !onCustomRange && !unitPicker && periods.length === 0 ? null : <PeriodCalendar phone={phone} active={customRange ?? null} onApply={onCustomRange} periods={periods} activePeriod={activePeriod} onPeriod={onPeriod} unitPicker={unitPicker} />}
            {phone ? null : <PeriodHelp />}
          </div>
          {phone ? null : unitPicker}
        </div>
      </div>
    </header>
  );
}
