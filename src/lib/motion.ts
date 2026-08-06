import type { Transition, Variants } from "motion/react";

/**
 * Design System Motion Tokens - Âncora CRM / CorreTop
 * Centraliza durações, easings, distâncias e variantes de animação.
 * Respeita preferências de movimento reduzido (prefers-reduced-motion).
 */

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.14,
    normal: 0.2,
    slow: 0.3,
  },
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    entrance: [0, 0, 0.2, 1] as const,
    exit: [0.4, 0, 1, 1] as const,
    bounce: [0.34, 1.56, 0.64, 1] as const,
  },
  distance: {
    sm: 4,
    md: 8,
    lg: 12,
    xl: 20,
  },
};

export const defaultTransition: Transition = {
  duration: motionTokens.duration.normal,
  ease: motionTokens.easing.entrance,
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: defaultTransition },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit } },
};

export const slideFadeUp: Variants = {
  initial: {
    opacity: 0,
    y: motionTokens.distance.md,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: defaultTransition,
  },
  exit: {
    opacity: 0,
    y: -motionTokens.distance.sm,
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit },
  },
};

export const slideFadeDown: Variants = {
  initial: {
    opacity: 0,
    y: -motionTokens.distance.md,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: defaultTransition,
  },
  exit: {
    opacity: 0,
    y: motionTokens.distance.sm,
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit },
  },
};

export const scaleIn: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: defaultTransition,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: motionTokens.duration.fast, ease: motionTokens.easing.exit },
  },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};
