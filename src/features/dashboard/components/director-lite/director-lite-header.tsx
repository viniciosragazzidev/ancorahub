"use client";

/**
 * Topo do painel da gestão, cópia 1:1 do artifact "Painel da gestão no estilo do corretor" (27/11/2026): abas com
 * ícone; saudação com a frase da situação; logo abaixo, à esquerda, "Precisa de você", o período (Hoje, 7 dias,
 * 30 dias), o calendário do intervalo personalizado e a unidade ou fila. No celular: topo com menu, saudação e
 * avisos; abas; "Precisa de você" e o calendário, que abre o período e a unidade ou fila.
 */
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { NotificationPopover } from "@/components/notification-popover";
import { useSidebar } from "@/components/ui/sidebar";

import styles from "./painel.module.css";
import { customRangeLabel, type CustomRange } from "./custom-range";
import { dateTitle } from "./format";

/** `short` é o rótulo do celular; o `label` completo segue no aria-label e no computador. */
export type HeaderOption = { value: string; label: string; href: string; short?: string };
export type HeaderUnit = { value: string; label: string };

const TAB_ICON_PATH: Record<string, string> = {
  overview: "M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z",
  quality: "M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z",
  funnel: "M3 4h18l-7 8v6l-4 2v-8z",
};

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }).format(now));
  return hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

function Segment({ label, items, active, onSelect, className }: { label: string; items: HeaderOption[]; active: string; onSelect?: (value: string) => void; className?: string }) {
  return (
    <div role="group" aria-label={label} className={`${styles.segment} ${className ?? ""}`}>
      {items.map((item) => {
        const current = item.value === active;
        const cls = `${styles.segbtn} ${current ? styles.segbtnOn : ""}`;
        return onSelect ? (
          <button key={item.value} type="button" className={cls} aria-pressed={current} onClick={() => onSelect(item.value)}>{item.label}</button>
        ) : (
          <Link key={item.value} href={item.href} className={cls} aria-current={current ? "true" : undefined}>{item.label}</Link>
        );
      })}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
  );
}

/** Calendário: intervalo personalizado (sem hora, o dia vai das 19h às 19h); no celular, também o período e a unidade. */
function PeriodCalendar({ active, onApply, phoneExtras }: { active: CustomRange | null; onApply?: (range: CustomRange) => void; phoneExtras: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);
  if (!onApply && !phoneExtras) return null;
  return (
    <div className={styles.calendar} ref={ref} data-desktop={onApply ? undefined : "hidden"}>
      <button
        type="button"
        className={`${styles.iconbtn} ${open || active ? styles.iconbtnOn : ""}`}
        aria-label={active ? `Período: ${customRangeLabel(active)}` : "Escolher um período personalizado"}
        title={active ? customRangeLabel(active) : "Período"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <CalendarIcon />
      </button>
      {open ? (
        <div role="dialog" aria-label="Período personalizado" className={`${styles.calendarPanel} ${styles.popover}`}>
          {phoneExtras ? <div className={styles.phoneOnly}>{phoneExtras}</div> : null}
          {onApply ? (
            <form
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const read = (name: string) => String(data.get(name) ?? "").trim();
                if (!read("from") || !read("to")) return;
                onApply({ from: read("from"), fromTime: null, to: read("to"), toTime: null });
                setOpen(false);
              }}
            >
              <span className={styles.calendarTitle}>Período personalizado</span>
              <div className={styles.rangeGrid}>
                <label className={styles.rangeField}>De<input className={styles.num} type="date" name="from" required defaultValue={active?.from} /></label>
                <label className={styles.rangeField}>Até<input className={styles.num} type="date" name="to" required defaultValue={active?.to} /></label>
              </div>
              <p className={styles.rangeHint}>O dia vai das 19h do dia anterior às 19h.</p>
              <div className={styles.rangeActions}>
                <button type="button" className={`${styles.pill} ${styles.pillQuiet}`} onClick={() => setOpen(false)}>Cancelar</button>
                <button type="submit" className={`${styles.pill} ${styles.pillPrimary}`}>Aplicar</button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PhoneMenuButton({ initials }: { initials: string }) {
  let sidebar: ReturnType<typeof useSidebar> | null = null;
  try {
    sidebar = useSidebar();
  } catch {
    sidebar = null;
  }
  return (
    <button type="button" className={styles.iconbtn} aria-label="Abrir menu principal" style={{ fontSize: 13, fontWeight: 500 }} onClick={() => sidebar?.setOpenMobile(true)}>
      {initials}
    </button>
  );
}

export function DirectorLiteHeader({ firstName, now, tabs, activeTab, onTab, periods, activePeriod, onPeriod, units, activeUnit, onUnit, unitLabel = "Unidade", customRange, onCustomRange, headline, action, summary, userName }: {
  firstName: string | null;
  /** Uma frase com a situação, logo abaixo da saudação ("Hoje entraram 86 leads."). */
  headline?: string | null;
  /** A ação do momento, antes do período (o botão "Precisa de você" da visão geral). */
  action?: ReactNode;
  /** Resumo do recorte no topo do celular ("Hoje · Todas as filas"). */
  summary?: string;
  /** Nome de quem olha, para as iniciais do botão de menu do celular. */
  userName?: string | null;
  now: Date;
  tabs: HeaderOption[];
  activeTab: string;
  onTab?: (value: string) => void;
  periods: HeaderOption[];
  activePeriod: string;
  onPeriod?: (value: string) => void;
  /** Sem `units` (ou vazio) o seletor some. */
  units?: HeaderUnit[];
  activeUnit: string;
  onUnit?: (value: string) => void;
  unitLabel?: string;
  customRange?: CustomRange | null;
  onCustomRange?: (range: CustomRange) => void;
}) {
  const hello = `${greeting(now)}${firstName ? `, ${firstName}` : ""}`;
  const initials = (userName || firstName || "Eu").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "Eu";
  const unitPicker = (className?: string) => units && units.length > 0 ? (
    <label className={`${styles.unit} ${className ?? ""}`}>
      <span className={styles.srOnly}>{unitLabel}</span>
      <select value={activeUnit} onChange={(event) => onUnit?.(event.target.value)} disabled={!onUnit}>
        {units.map((unit) => <option key={unit.value} value={unit.value}>{unit.label}</option>)}
      </select>
    </label>
  ) : null;
  const phoneExtras = (
    <>
      <span className={styles.calendarTitle}>Período</span>
      <Segment label="Período" items={periods} active={activePeriod} onSelect={onPeriod} />
      {unitPicker()}
    </>
  );
  return (
    <>
      <header className={styles.phoneHead}>
        <PhoneMenuButton initials={initials} />
        <div className={styles.phoneTitle}>
          <h1>{`Olá${firstName ? `, ${firstName}` : ""}`}</h1>
          {summary ? <p className={styles.num}>{summary}</p> : null}
        </div>
        <NotificationPopover />
      </header>

      {tabs.length ? (
        <nav aria-label="Seções do painel" className={`${styles.views} ${styles.in}`} title={`${dateTitle(now)}. O dia da operação começa às 19h.`}>
          {tabs.map((tab) => {
            const current = tab.value === activeTab;
            const cls = `${styles.viewbtn} ${current ? styles.viewbtnOn : ""}`;
            const content = (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={TAB_ICON_PATH[tab.value] ?? TAB_ICON_PATH.overview} /></svg>
                <span className={styles.viewLabelFull}>{tab.label}</span>
                <span className={styles.viewLabelShort} aria-hidden="true">{tab.short ?? tab.label}</span>
              </>
            );
            return onTab ? (
              <button key={tab.value} type="button" className={cls} aria-current={current ? "page" : undefined} aria-label={tab.label} onClick={() => onTab(tab.value)}>{content}</button>
            ) : (
              <Link key={tab.value} href={tab.href} className={cls} aria-current={current ? "page" : undefined} aria-label={tab.label}>{content}</Link>
            );
          })}
        </nav>
      ) : null}

      <header className={`${styles.head} ${styles.in}`}>
        <div className={styles.greeting}>
          <h1>{hello}</h1>
          {headline ? <p>{headline}</p> : null}
        </div>
        <div className={styles.controls}>
          {action}
          <Segment label="Período" items={periods} active={activePeriod} onSelect={onPeriod} className={styles.desktopOnly} />
          <PeriodCalendar active={customRange ?? null} onApply={onCustomRange} phoneExtras={phoneExtras} />
          {unitPicker(styles.desktopOnly)}
        </div>
      </header>
    </>
  );
}
