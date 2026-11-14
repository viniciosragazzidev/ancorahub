"use client";

import type { ReactNode } from "react";
import { useReducedMotion } from "motion/react";

import { motionTokens } from "@/components/arc/motion-tokens";
import { LiteAttention } from "@/components/lite/motion";

import { useRisePulse } from "./use-rise-pulse";

/**
 * Chave do pulso de um contador de aba (Fila, Leads). Chame no componente que fica montado mesmo com
 * o contador em zero: assim o 0 para 1 também pulsa. Com movimento reduzido, nunca há pulso.
 */
export function useRisePulseKey(count: number) {
  const reduce = useReducedMotion();
  const pulse = useRisePulse(count);
  return reduce ? undefined : pulse;
}

/**
 * Anel que pulsa uma única vez (240 ms, sem loop) quando `pulseKey` muda. Use com `useRisePulseKey`.
 */
export function RisePulse({ pulseKey, children, className }: { pulseKey: number | undefined; children: ReactNode; className?: string }) {
  return (
    <LiteAttention pulseKey={pulseKey} duration={motionTokens.duration.standard} className={className}>
      {children}
    </LiteAttention>
  );
}
