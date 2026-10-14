"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

/**
 * Motion shared by the Lite management screens (gestor and supervisor): page entry,
 * staggered lists and a press feedback. With prefers-reduced-motion only opacity moves.
 */

const enter = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } as const;

/** Page entry: fade and a short rise (150 to 250 ms). */
export function LitePageEnter({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={enter}
    >
      {children}
    </motion.div>
  );
}

const listVariants: Variants = {
  shown: { transition: { staggerChildren: motionTokens.stagger.item } },
};

function itemVariants(reduce: boolean | null): Variants {
  return {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 6 },
    shown: { opacity: 1, y: 0, transition: enter },
  };
}

/** List with a short stagger: each child is a LiteListItem. */
export function LiteList({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <motion.ul className={className} aria-label={label} variants={listVariants} initial="hidden" animate="shown">
      {children}
    </motion.ul>
  );
}

/** A list row: staggered entry and a press feedback (slight scale, none with reduced motion). */
export function LiteListItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li className={className} variants={itemVariants(reduce)} whileTap={reduce ? undefined : { scale: 0.99 }}>
      {children}
    </motion.li>
  );
}

/** Press feedback for a card or a link (slight scale, none with reduced motion). */
export function LitePress({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} whileTap={reduce ? undefined : { scale: 0.985 }} transition={{ duration: motionTokens.duration.fast }}>
      {children}
    </motion.div>
  );
}
