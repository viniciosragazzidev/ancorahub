"use client";

import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

import { easeStandard } from "./shared";

export interface LiteSuccessProps {
  /** Texto da confirmação; também é anunciado para leitor de tela. */
  label: string;
  className?: string;
}

/** Follow-through: o check chega um pouco menor e assenta com a mola `snappy` (leve passada e volta). O texto não balança. */
const CHECK_FROM_SCALE = 0.6;

/** Confirmação: o check se desenha (pathLength) e o texto aparece. Com movimento reduzido, já aparece pronto. */
export function LiteSuccess({ label, className }: LiteSuccessProps) {
  // Kill-switch html[data-interface-motion="off"] também entrega o check pronto.
  const motionEnabled = useInterfaceMotionEnabled();
  const reduce = useReducedMotion() || !motionEnabled;
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
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: CHECK_FROM_SCALE }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
        transition={reduce ? { duration: motionTokens.duration.instant } : { opacity: { duration: motionTokens.duration.instant }, scale: motionTokens.spring.snappy }}
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
