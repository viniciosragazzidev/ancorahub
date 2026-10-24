"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

export type LitePressKind = "button" | "row" | "card";

const TARGET_SCALE: Record<LitePressKind, number> = {
  button: motionTokens.scale.pressButton,
  row: motionTokens.scale.pressRow,
  card: motionTokens.scale.pressCard,
};

export interface LitePressProps {
  kind?: LitePressKind;
  children: ReactNode;
  className?: string;
}

/** Escala de toque por tipo de elemento, com mola curta. Com movimento reduzido, não escala. */
export function LitePress({ kind = "button", children, className }: LitePressProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      whileTap={reduce ? undefined : { scale: TARGET_SCALE[kind] }}
      transition={motionTokens.spring.snappy}
    >
      {children}
    </motion.div>
  );
}
