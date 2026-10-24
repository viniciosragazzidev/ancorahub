"use client";

import { useEffect, useRef } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeStandard } from "./shared";

export type LiteNumberFormat = "integer" | "decimal" | "currency" | "percent";

export interface LiteNumberProps {
  value: number;
  /** `percent` recebe o valor já em pontos percentuais (12 vira 12%). */
  format?: LiteNumberFormat;
  decimals?: number;
  /** Ao montar, rola de zero até o valor (KPI da sessão). Sem isso, o número aparece pronto. */
  countFromZero?: boolean;
  /** Anuncia o valor final para leitor de tela, numa região própria (aria-live educado). */
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
 * Número que muda, em odômetro: cada dígito é uma coluna de 0 a 9 que rola com motion values
 * (fora do ciclo de render do React), em 480 ms. O HTML inicial é sempre o valor final, no servidor
 * e no primeiro render do cliente; a contagem começa depois da hidratação. Com movimento reduzido,
 * o número vai direto ao final.
 */
export function LiteNumber({ value, format = "integer", decimals, countFromZero = false, live = false, className, locale = "pt-BR" }: LiteNumberProps) {
  const text = formatterFor(format, decimals, locale).format(format === "percent" ? value / 100 : value);
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      <span aria-hidden="true" style={{ display: "inline-flex", alignItems: "baseline" }}>
        {Array.from(text).map((char, index) =>
          /\d/.test(char) ? (
            <Digit key={index} digit={Number(char)} countFromZero={countFromZero} />
          ) : (
            <span key={index}>{char}</span>
          ),
        )}
      </span>
      <span className="sr-only" aria-live={live ? "polite" : undefined}>
        {text}
      </span>
    </span>
  );
}

/** Uma coluna de 0 a 9. `position` é o dígito atual em unidades de dígito; o motion anima essa posição. */
function Digit({ digit, countFromZero }: { digit: number; countFromZero: boolean }) {
  const reduce = useReducedMotion();
  const position = useMotionValue(digit);
  const opacity = useMotionValue(1);
  const offset = useTransform(position, (current) => `${-current * 10}%`);
  const started = useRef(false);

  useEffect(() => {
    if (!started.current) {
      started.current = true;
      if (!countFromZero || reduce) return;
      position.set(0);
      opacity.set(motionTokens.number.fromOpacity);
    } else if (reduce) {
      position.set(digit);
      opacity.set(1);
      return;
    }
    const move = animate(position, digit, { duration: motionTokens.duration.considered, ease: easeStandard });
    const fade = animate(opacity, 1, { duration: motionTokens.duration.considered, ease: easeStandard });
    return () => {
      move.stop();
      fade.stop();
    };
  }, [digit, reduce, countFromZero, position, opacity]);

  return (
    <motion.span style={{ display: "inline-block", height: "1em", overflow: "hidden", verticalAlign: "bottom", lineHeight: 1 }}>
      <motion.span style={{ display: "flex", flexDirection: "column", height: "1000%", y: offset, opacity }}>
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} style={{ display: "block", height: "10%" }}>
            {d}
          </span>
        ))}
      </motion.span>
    </motion.span>
  );
}
