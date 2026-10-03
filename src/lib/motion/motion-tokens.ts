/**
 * Motion Tokens Centralizados do AncoraHub
 * 
 * Regra: Nenhuma animação deve ter durações ou easings arbitrários.
 * Todos os componentes devem consumir estes tokens para garantir
 * ritmo visual consistente e alta previsibilidade.
 */

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.15,
    normal: 0.25,
    deliberate: 0.35,
    slow: 0.4,
  },
  distance: {
    xs: 2,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20,
  },
  scale: {
    press: 0.96,
    subtle: 0.99,
    enter: 0.98,
    hover: 1.01,
    pop: 1.04,
  },
  easings: {
    smoothOut: [0.22, 1, 0.36, 1] as const,
    easeInOut: [0.4, 0, 0.2, 1] as const,
    // Compatibility alias: shared operational controls never overshoot.
    bounceSubtle: [0.22, 1, 0.36, 1] as const,
  },
  spring: {
    soft: {
      type: "spring" as const,
      duration: 0.25,
      bounce: 0,
    },
    responsive: {
      type: "spring" as const,
      duration: 0.15,
      bounce: 0,
    },
    bouncy: {
      type: "spring" as const,
      duration: 0.25,
      bounce: 0,
    },
  },
};
