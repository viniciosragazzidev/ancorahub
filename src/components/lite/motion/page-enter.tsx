"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeEnter, reducedFade } from "./shared";

export interface LitePageEnterProps {
  children: ReactNode;
  className?: string;
}

/** Entrada da página: fade e subida de 8 px em 240 ms. Com movimento reduzido, só opacidade. */
export function LitePageEnter({ children, className }: LitePageEnterProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.md }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeEnter }}
    >
      {children}
    </motion.div>
  );
}
