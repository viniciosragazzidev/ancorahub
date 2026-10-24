"use client";

import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeStandard } from "./shared";

export interface LiteProgressProps {
  /** Progresso de 0 a 100. Valores fora da faixa são limitados. */
  value: number;
  label: string;
  className?: string;
}

/** Barra que cresce com scaleX a partir da esquerda (origem fixa), em 480 ms. Com movimento reduzido, troca direto. */
export function LiteProgress({ value, label, className }: LiteProgressProps) {
  const reduce = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, value));
  const ratio = clamped / 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={className}
      style={{ position: "relative", height: 8, overflow: "hidden", borderRadius: 9999, background: "var(--surface-muted)" }}
    >
      <motion.div
        style={{ position: "absolute", inset: 0, background: "var(--primary)", transformOrigin: "left center" }}
        initial={{ scaleX: reduce ? ratio : 0 }}
        animate={{ scaleX: ratio }}
        transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.considered, ease: easeStandard }}
      />
    </div>
  );
}
