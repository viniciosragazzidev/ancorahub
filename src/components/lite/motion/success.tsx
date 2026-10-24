"use client";

import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeStandard } from "./shared";

export interface LiteSuccessProps {
  /** Texto da confirmação; também é anunciado para leitor de tela. */
  label: string;
  className?: string;
}

/** Confirmação: o check se desenha (pathLength) e o texto aparece. Com movimento reduzido, já aparece pronto. */
export function LiteSuccess({ label, className }: LiteSuccessProps) {
  const reduce = useReducedMotion();
  return (
    <span role="status" className={className} style={{ display: "inline-flex", alignItems: "center", gap: motionTokens.distance.xs * 2 }}>
      <motion.svg
        aria-hidden
        width={16}
        height={16}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: motionTokens.duration.instant }}
      >
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          initial={{ pathLength: reduce ? 1 : 0 }}
          animate={{ pathLength: 1 }}
          transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.draw, ease: easeStandard }}
        />
      </motion.svg>
      <span>{label}</span>
    </span>
  );
}
