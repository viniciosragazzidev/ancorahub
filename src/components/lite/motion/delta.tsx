"use client";

import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeEnter, reducedFade } from "./shared";

export interface LiteDeltaProps {
  /** Variação em pontos percentuais (12 vira +12%). */
  value: number;
  decimals?: number;
  className?: string;
  locale?: string;
}

const TONE_COLOR = {
  up: "var(--success)",
  down: "var(--danger)",
  flat: "var(--text-muted)",
} as const;

/** Pílula de variação que entra logo depois do número (80 ms). Com movimento reduzido, só opacidade. */
export function LiteDelta({ value, decimals = 0, className, locale = "pt-BR" }: LiteDeltaProps) {
  const reduce = useReducedMotion();
  const tone = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const text = new Intl.NumberFormat(locale, {
    style: "percent",
    signDisplay: "exceptZero",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
  return (
    <motion.span
      className={className}
      data-tone={tone}
      style={{ color: TONE_COLOR[tone], fontVariantNumeric: "tabular-nums" }}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.xs }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeEnter, delay: motionTokens.stagger.line }}
    >
      {text}
    </motion.span>
  );
}
