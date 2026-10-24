"use client";

/**
 * Helpers de movimento do painel do diretor. Sai dos tokens (`motion-tokens.ts`) e reaproveita
 * o `LiteNumber` do kit (`@/components/lite/motion`). Os demais são locais porque o kit não tem
 * a forma exata (pílula de texto, barra de cor de série, `li` e `section` com atraso).
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

import { motionTokens as m } from "@/components/arc/motion-tokens";
import { LiteNumber as KitLiteNumber } from "@/components/lite/motion";

import styles from "./director-lite.module.css";

export const enterT: Transition = { duration: m.duration.standard, ease: [...m.ease.enter] };
export const exitT: Transition = { duration: m.duration.exit, ease: [...m.ease.exit] };
export const fadeT: Transition = { duration: m.duration.instant };

/** Atraso de cascata: até `stagger.max - 1` passos distintos. */
export const staggerDelay = (index: number) => Math.min(index, m.stagger.max - 1) * m.stagger.item;

export function useReduce() {
  return !!useReducedMotion();
}

/** Número que muda (odômetro do kit). `kind` segue o da prévia: inteiro, percentual, real ou decimal. */
export function LiteNumber({ value, kind = "int", decimals, className }: { value: number; kind?: "int" | "pct" | "brl" | "dec"; decimals?: number; className?: string }) {
  const format = kind === "pct" ? "percent" : kind === "brl" ? "currency" : kind === "dec" ? "decimal" : "integer";
  return <KitLiteNumber value={value} format={format} decimals={decimals} className={className} />;
}

/** Pílula de variação com texto (ex.: "Pede ação"). Entra 80 ms depois do número. */
export function LiteDelta({ children, tone = "warning", show = true }: { children: ReactNode; tone?: "warning" | "danger" | "success" | "neutral"; show?: boolean }) {
  const reduce = useReduce();
  if (!show) return null;
  return (
    <motion.span
      className={styles.badge}
      data-tone={tone}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: m.distance.xs }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? fadeT : { ...enterT, delay: m.stagger.line }}
    >
      {children}
    </motion.span>
  );
}

/** Anel único que chama atenção quando `pulse` muda. Sem movimento reduzido, só some. */
export function LiteAttention({ pulse }: { pulse: number }) {
  const reduce = useReduce();
  if (!pulse) return null;
  return (
    <motion.span
      key={pulse}
      aria-hidden="true"
      className={styles.attention}
      initial={{ opacity: m.attention.opacity, scale: 1 }}
      animate={{ opacity: 0, scale: reduce ? 1 : m.scale.attention }}
      transition={{ duration: reduce ? m.duration.instant : m.attention.duration, ease: [...m.ease.standard] }}
    />
  );
}

/** Barra de volume (0 a 1), que cresce a partir da esquerda, com cor de série opcional. */
export function LiteBar({ value, delay = 0, tone = "primary", className, height }: { value: number; delay?: number; tone?: string; className?: string; height?: number }) {
  const reduce = useReduce();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span className={`${styles.track} ${className ?? ""}`} style={height ? { height } : undefined} aria-hidden="true">
      <motion.span
        className={styles.fill}
        data-tone={tone}
        style={{ transformOrigin: "left center" }}
        initial={{ scaleX: reduce ? clamped : 0 }}
        animate={{ scaleX: clamped }}
        transition={reduce ? { duration: 0 } : { duration: m.duration.considered, ease: [...m.ease.standard], delay }}
      />
    </span>
  );
}

/** Item de lista com cascata. `as="li"` mantém a lista semântica. */
export function LiteItem({ children, index, className, as = "div" }: { children: ReactNode; index: number; className?: string; as?: "div" | "li" }) {
  const reduce = useReduce();
  const Tag = as === "li" ? motion.li : motion.div;
  return (
    <Tag
      className={className}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: m.distance.sm }}
      animate={{ opacity: 1, y: 0, transition: reduce ? fadeT : { ...enterT, delay: staggerDelay(index) } }}
    >
      {children}
    </Tag>
  );
}

/** Bloco que entra ao rolar até a vista, uma vez. `as` escolhe `section` ou `div`. */
export function LiteReveal({ children, className, delay = 0, as = "div", label }: { children: ReactNode; className?: string; delay?: number; as?: "div" | "section"; label?: string }) {
  const reduce = useReduce();
  const Tag = as === "section" ? motion.section : motion.div;
  return (
    <Tag
      className={className}
      aria-label={label}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: m.distance.lg }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={reduce ? fadeT : { ...enterT, delay }}
    >
      {children}
    </Tag>
  );
}
