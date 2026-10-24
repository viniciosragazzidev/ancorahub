"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeStandard } from "./shared";

export type LiteNumberFormat = "integer" | "decimal" | "currency" | "percent";

export interface LiteNumberProps {
  value: number;
  /** `percent` recebe o valor já em pontos percentuais (12 vira 12%). */
  format?: LiteNumberFormat;
  decimals?: number;
  /** Conta de zero na primeira renderização (KPI da sessão). Por padrão, mostra o valor direto. */
  countFromZero?: boolean;
  /** Anuncia a mudança para leitor de tela (aria-live educado). */
  live?: boolean;
  className?: string;
  locale?: string;
}

function formatterFor(format: LiteNumberFormat, decimals: number | undefined, locale: string) {
  if (format === "currency") {
    const digits = decimals ?? 2;
    return new Intl.NumberFormat(locale, { style: "currency", currency: "BRL", minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  if (format === "percent") {
    const digits = decimals ?? 0;
    return new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits });
  }
  const digits = format === "decimal" ? (decimals ?? 1) : (decimals ?? 0);
  return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/**
 * Número que muda: conta até o novo valor em 480 ms (pt-BR, tabular-nums, sem blur).
 * Com movimento reduzido mostra o número final direto.
 */
export function LiteNumber({ value, format = "integer", decimals, countFromZero = false, live = false, className, locale = "pt-BR" }: LiteNumberProps) {
  const reduce = !!useReducedMotion();
  const formatter = formatterFor(format, decimals, locale);
  const [shown, setShown] = useState(() => (countFromZero && !reduce ? 0 : value));
  const current = useRef(shown);

  useEffect(() => {
    if (reduce) {
      current.current = value;
      return;
    }
    const controls = animate(current.current, value, {
      duration: motionTokens.duration.considered,
      ease: easeStandard,
      onUpdate: (next) => {
        current.current = next;
        setShown(next);
      },
    });
    return () => controls.stop();
  }, [value, reduce]);

  const rendered = reduce ? value : shown;
  const text = formatter.format(format === "percent" ? rendered / 100 : rendered);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }} aria-live={live ? "polite" : undefined}>
      {text}
    </span>
  );
}
