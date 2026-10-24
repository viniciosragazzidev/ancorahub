"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeStandard } from "./shared";

export interface LiteAttentionProps {
  /**
   * Troca de valor dispara um pulso único (anel que cresce e some). Sem valor, não há pulso.
   * Cada valor novo refaz a animação uma vez.
   */
  pulseKey?: string | number;
  children: ReactNode;
  className?: string;
}

/**
 * Chama atenção para algo que mudou. O anel é um elemento sobreposto que anima só scale e opacity,
 * uma vez, e nunca em loop. Com movimento reduzido, só opacidade e sem crescer.
 */
export function LiteAttention({ pulseKey, children, className }: LiteAttentionProps) {
  const reduce = useReducedMotion();
  return (
    <span className={className} style={{ position: "relative", display: "inline-flex" }}>
      {children}
      {pulseKey !== undefined ? (
        <motion.span
          key={String(pulseKey)}
          aria-hidden
          style={{ position: "absolute", inset: 0, borderRadius: "inherit", border: "2px solid var(--primary)", pointerEvents: "none" }}
          initial={{ opacity: motionTokens.attention.opacity, scale: 1 }}
          animate={{ opacity: 0, scale: reduce ? 1 : motionTokens.scale.attention }}
          transition={{ duration: reduce ? motionTokens.duration.instant : motionTokens.attention.duration, ease: easeStandard }}
        />
      ) : null}
    </span>
  );
}
