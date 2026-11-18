"use client";

import type { ReactNode } from "react";
import { motion, type Variants } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { LitePageEnter, LitePress as KitPress } from "@/components/lite/motion";
import { useMotionAllowed } from "@/components/motion/use-motion-allowed";

/**
 * Compatibilidade: entrada de página e pressão vêm do kit `@/components/lite/motion`
 * (fonte única desde 18/11/2026). Só a lista semântica (`ul`/`li`) fica aqui, porque o kit
 * cascateia `div`s. Código novo importa direto do kit.
 */

export { LitePageEnter };

/** Pressão de card ou link: escala `pressCard` do kit. */
export function LitePress({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <KitPress kind="card" className={className}>
      {children}
    </KitPress>
  );
}

const listVariants: Variants = {
  shown: { transition: { staggerChildren: motionTokens.stagger.item } },
};

const enter = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } as const;

function itemVariants(reduce: boolean): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: motionTokens.distance.sm },
    shown: { opacity: 1, y: 0, transition: enter },
  };
}

/** Lista com cascata curta: cada filho é um LiteListItem. */
export function LiteList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <motion.ul className={className} aria-label={label} variants={listVariants} initial="hidden" animate="shown">
      {children}
    </motion.ul>
  );
}

/** Linha da lista: entra em cascata e escala `pressRow` ao tocar (nada com movimento reduzido). */
export function LiteListItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = !useMotionAllowed();
  return (
    <motion.li
      className={className}
      variants={itemVariants(reduce)}
      whileTap={reduce ? undefined : { scale: motionTokens.scale.pressRow }}
    >
      {children}
    </motion.li>
  );
}
