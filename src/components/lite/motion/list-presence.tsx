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
 * Linha que entra (subida de 4 px e fade) e sai (fade com as linhas da grade indo de 1fr a 0fr,
 * sem animar altura), e as outras reorganizam com layout. Cada filho precisa de `key`.
 * Com movimento reduzido, só opacidade e sem reordenar.
 */
export function LiteListPresence({ children, className }: LiteListPresenceProps) {
  const reduce = useReducedMotion();
  return (
    <div className={className}>
      <AnimatePresence initial={false}>
        {Children.map(children, (child) => (
          <motion.div
            layout={reduce ? false : "position"}
            style={{ display: "grid", gridTemplateRows: "1fr" }}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -motionTokens.distance.xs }}
            animate={{ opacity: 1, y: 0 }}
            exit={
              reduce
                ? { opacity: 0, transition: reducedFade }
                : { opacity: 0, gridTemplateRows: "0fr", transition: { duration: motionTokens.duration.exit, ease: easeExit } }
            }
            transition={reduce ? reducedFade : motionTokens.spring.smooth}
          >
            <div style={{ minHeight: 0, overflow: "hidden" }}>{child}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
