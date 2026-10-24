"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeEnter, reducedFade } from "./shared";

export interface LiteRevealProps {
  children: ReactNode;
  className?: string;
  /** Fração do bloco que precisa estar na tela para entrar. */
  amount?: number;
}

/** Entra ao rolar até a vista, uma vez: fade e subida de 12 px. Com movimento reduzido, só opacidade. */
export function LiteReveal({ children, className, amount = 0.2 }: LiteRevealProps) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.lg }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={reduce ? reducedFade : { duration: motionTokens.duration.standard, ease: easeEnter }}
    >
      {children}
    </motion.div>
  );
}
