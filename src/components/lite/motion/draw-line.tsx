"use client";

import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeStandard } from "./shared";

export interface LiteDrawLineProps {
  /** Caminho SVG da linha (atributo d). */
  d: string;
  viewBox: string;
  /** Descrição para leitor de tela. */
  label: string;
  className?: string;
  strokeWidth?: number;
}

/** Linha de gráfico ou sparkline que se desenha (pathLength) em 480 ms. Com movimento reduzido, já aparece pronta. */
export function LiteDrawLine({ d, viewBox, label, className, strokeWidth = 2 }: LiteDrawLineProps) {
  const reduce = useReducedMotion();
  return (
    <svg role="img" aria-label={label} viewBox={viewBox} className={className} preserveAspectRatio="none">
      <motion.path
        d={d}
        fill="none"
        stroke="var(--primary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: reduce ? 1 : 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.considered, ease: easeStandard }}
      />
    </svg>
  );
}
