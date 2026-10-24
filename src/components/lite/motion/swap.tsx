"use client";

import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeEnter, reducedFade } from "./shared";

export interface LiteSwapProps {
  /** Muda quando o conteúdo muda; a troca acontece no mesmo lugar. */
  swapKey: string | number;
  children: ReactNode;
  className?: string;
}

/**
 * Troca de conteúdo no mesmo lugar (carregando para pronto, aba A para B).
 * Sai com fade em 120 ms; entra com fade e subida de 4 px.
 */
export function LiteSwap({ swapKey, children, className }: LiteSwapProps) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        key={swapKey}
        className={className}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.xs }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: reducedFade }}
        transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeEnter }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
