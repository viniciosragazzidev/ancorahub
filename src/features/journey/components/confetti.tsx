"use client";

import { useMemo } from "react";
import { motion } from "motion/react";

import styles from "./journey.module.css";

/** Deterministic "random" in [0, 1): same pieces every render, no impure calls. */
function scatter(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

const COLORS = ["oklch(66% .17 212)", "oklch(72% .17 28)", "oklch(68% .17 150)", "oklch(64% .19 268)", "oklch(70% .17 330)", "oklch(80% .15 85)"];

/** Celebration confetti (the tour's, shared). The parent hides it when motion is reduced. */
export function Confetti({ pieces: count = 46, seed = 1 }: { pieces?: number; seed?: number }) {
  const pieces = useMemo(
    () => Array.from({ length: count }, (_, position) => ({
      id: position,
      left: scatter(position, seed) * 100,
      delay: scatter(position, seed + 1) * 0.35,
      drift: (scatter(position, seed + 2) - 0.5) * 160,
      rotate: (scatter(position, seed + 3) - 0.5) * 540,
      size: 6 + scatter(position, seed + 4) * 6,
      color: COLORS[position % COLORS.length],
      round: position % 3 === 0,
      duration: 2.4 + scatter(position, seed + 5),
    })),
    [count, seed],
  );
  return (
    <div className={styles.confetti} aria-hidden="true">
      {pieces.map((piece) => (
        <motion.span
          key={piece.id}
          style={{ left: `${piece.left}%`, width: piece.size, height: piece.round ? piece.size : piece.size * 0.45, background: piece.color, borderRadius: piece.round ? 999 : 2 }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: piece.drift, rotate: piece.rotate, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: piece.duration, delay: piece.delay, ease: [0.2, 0.6, 0.4, 1] }}
        />
      ))}
    </div>
  );
}
