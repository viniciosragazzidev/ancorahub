"use client";

import { Children, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";

import { easeExit, reducedFade } from "./shared";

export interface LiteListPresenceProps {
  children: ReactNode;
  className?: string;
}

/**
 * Linha que entra (subida de 4 px e fade) e sai (fade com a altura colapsando), e as outras
 * reorganizam com layout. Cada filho precisa de `key`. Com movimento reduzido, só opacidade e sem reordenar.
 */
export function LiteListPresence({ children, className }: LiteListPresenceProps) {
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      <AnimatePresence initial={false}>
        {Children.map(children, (child) => (
          <motion.div
            layout={reduce ? false : "position"}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -motionTokens.distance.xs }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduce
                ? { opacity: 0, transition: reducedFade }
                : { opacity: 0, height: 0, transition: { duration: motionTokens.duration.exit, ease: easeExit } }
            }
            transition={reduce ? reducedFade : motionTokens.spring.smooth}
          >
            {child}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
