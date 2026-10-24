"use client";

import { Children, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeEnter, reducedFade } from "./shared";

export interface LiteStaggerProps {
  children: ReactNode;
  className?: string;
}

/**
 * Cascata de filhos diretos. Cada item entra com atraso de 35 ms; do 9º em diante
 * o atraso para no máximo (stagger.max = 8), então as linhas restantes entram juntas.
 */
export function LiteStagger({ children, className }: LiteStaggerProps) {
  return (
    <div className={className}>
      {Children.map(children, (child, index) => (
        <LiteStaggerItem index={index}>{child}</LiteStaggerItem>
      ))}
    </div>
  );
}

export interface LiteStaggerItemProps {
  index: number;
  children: ReactNode;
  className?: string;
}

/** Item avulso da cascata; `index` define o atraso. Usado direto quando o pai não é uma lista. */
export function LiteStaggerItem({ index, children, className }: LiteStaggerItemProps) {
  const reduce = useReducedMotion();
  const step = Math.min(index, motionTokens.stagger.max);
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.sm }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? reducedFade
          : { duration: motionTokens.duration.exit, ease: easeEnter, delay: step * motionTokens.stagger.item }
      }
    >
      {children}
    </motion.div>
  );
}
