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
    fast: 0.14,
    normal: 0.2,
    deliberate: 0.28,
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
    press: 0.97,
    subtle: 0.99,
    enter: 0.98,
    hover: 1.01,
    pop: 1.04,
  },
  easings: {
    smoothOut: [0.16, 1, 0.3, 1] as const,
    easeInOut: [0.4, 0, 0.2, 1] as const,
    bounceSubtle: [0.34, 1.56, 0.64, 1] as const,
  },
  spring: {
    soft: {
      type: "spring" as const,
      stiffness: 350,
      damping: 30,
    },
    responsive: {
      type: "spring" as const,
      stiffness: 500,
      damping: 32,
    },
    bouncy: {
      type: "spring" as const,
      stiffness: 400,
      damping: 22,
    },
  },
};
