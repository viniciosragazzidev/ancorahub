"use client";

import { motion } from "motion/react";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";

import { motionTokens } from "@/components/arc/motion-tokens";

export interface LiteHighlightProps {
  /** Mesmo id em todos os itens do grupo: a pílula desliza entre eles. */
  layoutId: string;
  active: boolean;
  className?: string;
}

/**
 * Destaque compartilhado (pílula da aba ativa, do filtro, da linha selecionada).
 * Deve ficar dentro de um pai com `position: relative`. Com movimento reduzido, troca sem deslizar.
 */
export function LiteHighlight({ layoutId, active, className }: LiteHighlightProps) {
  const reduce = !useMotionAllowed();
  if (!active) return null;
  return (
    <motion.span
      aria-hidden
      layoutId={layoutId}
      className={className}
      style={{ position: "absolute", inset: 0, borderRadius: "inherit" }}
      transition={reduce ? { duration: 0 } : motionTokens.spring.morph}
    />
  );
}
