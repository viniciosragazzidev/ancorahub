"use client";

import type { Variants, Transition } from "motion/react";

/* ─── Tokens de movimento (MACRO-MICRO §4) ─── */

export const motionTokens = {
  duration: {
    instant: 0.08,
    fast: 0.12,
    base: 0.18,
    medium: 0.24,
    slow: 0.32,
    slower: 0.42,
    emphasis: 0.56,
  },
  delay: {
    none: 0,
    subtle: 0.04,
    base: 0.08,
    contextual: 0.12,
    stagger: 0.04,
  },
  distance: {
    xsmall: 2,
    small: 4,
    base: 8,
    medium: 12,
    large: 16,
    panel: 24,
  },
  scale: {
    pressed: 0.98,
    subtle: 0.99,
    enter: 0.96,
    emphasized: 1.02,
  },
} as const;

export const ease = {
  standard: [0.2, 0, 0, 1] as const,
  enter: [0, 0, 0.2, 1] as const,
  exit: [0.4, 0, 1, 1] as const,
  emphasized: [0.2, 0.8, 0.2, 1] as const,
};

export const spring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
};

/* ─── Shared transitions ─── */

export const fastTransition: Transition = {
  duration: motionTokens.duration.fast,
  ease: ease.standard,
};

export const baseTransition: Transition = {
  duration: motionTokens.duration.base,
  ease: ease.standard,
};

export const enterTransition: Transition = {
  duration: motionTokens.duration.base,
  ease: ease.enter,
};

export const exitTransition: Transition = {
  duration: motionTokens.duration.fast,
  ease: ease.exit,
};

/* ─── Variants (MACRO-MICRO §44) ─── */

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: motionTokens.distance.base },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.base, ease: ease.enter },
  },
  exit: {
    opacity: 0,
    y: -motionTokens.distance.small,
    transition: { duration: motionTokens.duration.fast, ease: ease.exit },
  },
};

export const fadeDownVariants: Variants = {
  hidden: { opacity: 0, y: -motionTokens.distance.base },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionTokens.duration.base, ease: ease.enter },
  },
  exit: {
    opacity: 0,
    y: motionTokens.distance.small,
    transition: { duration: motionTokens.duration.fast, ease: ease.exit },
  },
};

export const fadeLeftVariants: Variants = {
  hidden: { opacity: 0, x: -motionTokens.distance.base },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: motionTokens.duration.base, ease: ease.enter },
  },
  exit: {
    opacity: 0,
    x: motionTokens.distance.base,
    transition: { duration: motionTokens.duration.fast, ease: ease.exit },
  },
};

export const scaleInVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: motionTokens.scale.enter,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: motionTokens.duration.base, ease: ease.enter },
  },
  exit: {
    opacity: 0,
    scale: motionTokens.scale.subtle,
    transition: { duration: motionTokens.duration.fast, ease: ease.exit },
  },
};

export const scaleSlideVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: motionTokens.scale.enter,
    y: motionTokens.distance.small,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: motionTokens.duration.medium,
      ease: ease.enter,
    },
  },
  exit: {
    opacity: 0,
    scale: motionTokens.scale.subtle,
    y: -motionTokens.distance.small,
    transition: {
      duration: motionTokens.duration.fast,
      ease: ease.exit,
    },
  },
};

/* ─── Sidebar item variants ─── */

export const sidebarItemVariants: Variants = {
  hidden: { opacity: 0, x: -motionTokens.distance.medium },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: motionTokens.duration.base,
      ease: ease.enter,
      delay: i * motionTokens.delay.stagger,
    },
  }),
};

/* ─── Card grid variants ─── */

export const cardGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: motionTokens.delay.stagger * 2,
      delayChildren: motionTokens.delay.subtle,
    },
  },
};

export const cardItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: motionTokens.distance.medium,
    scale: 0.98,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: motionTokens.duration.base,
      ease: ease.enter,
    },
  },
};

/* ─── List item variants ─── */

export const listItemVariants: Variants = {
  hidden: { opacity: 0, x: -motionTokens.distance.small },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: {
      duration: motionTokens.duration.fast,
      ease: ease.enter,
      delay: Math.min(i * motionTokens.delay.stagger, motionTokens.duration.slower),
    },
  }),
};

/* ─── Collapse / Accordion ─── */

export const collapseVariants: Variants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: { duration: motionTokens.duration.medium, ease: ease.standard },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: motionTokens.duration.fast, ease: ease.exit },
  },
};

/* ─── Badge / Notification ─── */

export const badgePopVariants: Variants = {
  hidden: { opacity: 0, scale: 0.5, filter: "blur(2px)" },
  visible: {
    opacity: 1,
    scale: 1,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 20,
      mass: 0.6,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    filter: "blur(2px)",
    transition: { duration: motionTokens.duration.fast, ease: ease.exit },
  },
};

/* ─── Shake (error) ─── */

export const shakeVariants: Variants = {
  hidden: { x: 0 },
  visible: {
    x: [0, -4, 4, -2, 2, 0],
    transition: { duration: motionTokens.duration.medium, ease: ease.standard },
  },
};

/* ─── Page transition ─── */

export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: motionTokens.duration.base,
      ease: ease.enter,
      when: "beforeChildren",
      staggerChildren: motionTokens.delay.stagger,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: motionTokens.duration.fast,
      ease: ease.exit,
    },
  },
};

/* ─── Scale press (button micro-interaction) ─── */

export const pressScale = {
  whileHover: { scale: 1.01, transition: { duration: motionTokens.duration.fast } },
  whileTap: { scale: motionTokens.scale.pressed, transition: { duration: motionTokens.duration.instant } },
};
