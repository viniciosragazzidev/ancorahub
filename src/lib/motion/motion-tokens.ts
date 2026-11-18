import { motionTokens as canonical } from "@/components/arc/motion-tokens";

/**
 * Motion Tokens Centralizados do AncoraHub
 *
 * Apelidos de `src/components/arc/motion-tokens.ts` (fonte única desde 18/11/2026).
 * Não coloque número aqui: mude o canônico.
 * 
 * Regra: Nenhuma animação deve ter durações ou easings arbitrários.
 * Todos os componentes devem consumir estes tokens para garantir
 * ritmo visual consistente e alta previsibilidade.
 */

export const motionTokens = {
  duration: {
    instant: canonical.duration.instant,
    fast: canonical.duration.fast,
    normal: canonical.duration.standard,
    deliberate: canonical.duration.draw,
    slow: canonical.duration.considered,
  },
  distance: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20,
  },
  scale: {
    press: 0.97,
    subtle: 0.99,
    enter: 0.98,
    hover: 1.01,
    pop: 1.04,
  },
  easings: {
    smoothOut: canonical.ease.standard,
    easeInOut: canonical.ease.inOut,
    // Compatibility alias: shared operational controls never overshoot.
    bounceSubtle: canonical.ease.standard,
  },
  spring: {
    soft: {
      type: "spring" as const,
      duration: canonical.duration.standard,
      bounce: 0,
    },
    responsive: {
      type: "spring" as const,
      duration: canonical.duration.fast,
      bounce: 0,
    },
    bouncy: {
      type: "spring" as const,
      duration: canonical.duration.standard,
      bounce: 0,
    },
  },
};
