"use client";

/**
 * Gráficos do pós-venda (24/11), num só tom: azul de ação para respondidas e o mesmo azul suave para enviadas.
 * Cada gráfico tem tabela equivalente para leitor de tela (caption + números no texto) e dica no hover.
 */
import { useState } from "react";

import type { DayBreakdown, FunnelStep, PostSaleRuleBucket, RuleBreakdown } from "@/features/post-sale-audit/overview";

import styles from "./post-sale.module.css";

const fmt = (value: number) => value.toLocaleString("pt-BR");

function width(value: number, max: number) {
  return `${max ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0}%`;
}

/** Funil: cada passo em relação às enviadas. */
export function PostSaleFunnel({ steps }: { steps: FunnelStep[] }) {
  const max = steps[0]?.value ?? 0;
  return (
    <ol className={styles.hbars} aria-label="Funil do envio até a resposta">
      {steps.map((step, index) => (
        <li key={step.id} className={styles.hbarRow}>
          <span className={styles.hbarLabel}>{step.label}</span>
          <span className={styles.hbarTrack} aria-hidden="true">
            <span className={index >= 3 ? styles.hbarFill : styles.hbarFillSoft} style={{ width: width(step.value, max), animationDelay: `${index * 40}ms` }} />
          </span>
          <span className={styles.hbarValue}>{fmt(step.value)}{index > 0 && step.percent !== null ? <span> · {step.percent}%</span> : null}</span>
        </li>
      ))}
    </ol>
  );
}

/** Por regra: enviadas (suave) com respondidas por cima. Clique leva para os leads da regra. */
export function PostSaleRuleBars({ rules, onSelect }: { rules: RuleBreakdown[]; onSelect?: (key: PostSaleRuleBucket) => void }) {
  if (!rules.length) return <p className={styles.detail}>Nenhuma pesquisa no período.</p>;
  const max = Math.max(...rules.map((rule) => rule.sent || rule.total));
  return (
    <ul className={styles.hbars} aria-label="Pesquisas por regra">
      {rules.map((rule, index) => {
        const content = (
          <>
            <span className={styles.hbarLabel} title={rule.label}>{rule.label}</span>
            <span className={styles.hbarTrack} aria-hidden="true">
              <span className={styles.hbarFillSoft} style={{ width: width(rule.sent, max), animationDelay: `${index * 40}ms` }} />
              <span className={styles.hbarFill} style={{ width: width(rule.responded, max), animationDelay: `${index * 40 + 80}ms` }} />
            </span>
            <span className={styles.hbarValue}>
              {fmt(rule.responded)} de {fmt(rule.sent)}
              {rule.responseRate !== null ? <span> · {rule.responseRate}%</span> : null}
              {rule.failed ? <span> · {fmt(rule.failed)} não {rule.failed === 1 ? "saiu" : "saíram"}</span> : null}
            </span>
          </>
        );
        return (
          <li key={rule.key}>
            {onSelect ? (
              <button type="button" className={`${styles.hbarRow} ${styles.hbarRowButton}`} onClick={() => onSelect(rule.key)} aria-label={`${rule.label}: ${rule.responded} responderam de ${rule.sent} enviadas. Ver os leads`}>
                {content}
              </button>
            ) : <div className={styles.hbarRow}>{content}</div>}
          </li>
        );
      })}
    </ul>
  );
}

const dayLabel = (day: string, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit" }) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year!, month! - 1, date!, 12)));
};

/** Por dia de envio: uma coluna por dia (enviadas) com as respondidas dentro. Clique filtra a lista de leads. */
export function PostSaleDayColumns({ days, selected, onSelect }: { days: DayBreakdown[]; selected?: string; onSelect?: (day: string) => void }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...days.map((day) => day.sent));
  const first = days[0];
  const last = days[days.length - 1];
  return (
    <div>
      <div className={styles.columns} role="group" aria-label="Pesquisas por dia de envio">
        {days.map((day, index) => {
          const tip = hover === day.day;
          const edge = index > days.length - 4 ? { right: 0 } : index < 3 ? { left: 0 } : { left: "50%", transform: "translateX(-50%)" };
          return (
            <button
              key={day.day}
              type="button"
              className={styles.column}
              aria-pressed={selected === day.day}
              aria-label={`${dayLabel(day.day, { weekday: "long", day: "2-digit", month: "2-digit" })}: ${day.sent} enviadas, ${day.responded} responderam`}
              onMouseEnter={() => setHover(day.day)}
              onMouseLeave={() => setHover((current) => current === day.day ? null : current)}
              onFocus={() => setHover(day.day)}
              onBlur={() => setHover(null)}
              onClick={() => onSelect?.(selected === day.day ? "" : day.day)}
            >
              <span className={styles.columnSent} style={{ height: `${(day.sent / max) * 100}%`, animationDelay: `${Math.min(index, 20) * 15}ms` }} />
              <span className={styles.columnResponded} style={{ height: `${(day.responded / max) * 100}%`, animationDelay: `${Math.min(index, 20) * 15 + 80}ms` }} />
              {tip ? (
                <span className={styles.tooltip} style={edge}>
                  <strong style={{ fontWeight: 500 }}>{dayLabel(day.day, { weekday: "short", day: "2-digit", month: "2-digit" })}</strong><br />
                  {fmt(day.sent)} enviadas<br />
                  {fmt(day.responded)} responderam
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {first && last ? <div className={styles.axis} aria-hidden="true"><span>{dayLabel(first.day)}</span><span>{dayLabel(last.day)}</span></div> : null}
    </div>
  );
}

export function PostSaleLegend() {
  return (
    <ul className={styles.legend}>
      <li><span className={styles.swatchSoft} aria-hidden="true" />Enviadas</li>
      <li><span className={styles.swatch} aria-hidden="true" />Responderam</li>
    </ul>
  );
}
