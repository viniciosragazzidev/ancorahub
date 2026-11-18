"use client";

import type { Variants, Transition } from "motion/react";
import { motionTokens as canonical } from "@/components/arc/motion-tokens";

/* ─── Tokens de movimento: apelidos de src/components/arc/motion-tokens.ts (fonte única desde 18/11/2026) ─── */

export const motionTokens = {
  duration: {
    instant: canonical.duration.instant,
    fast: canonical.duration.fast,
    base: canonical.duration.exit,
    medium: canonical.duration.standard,
    slow: canonical.duration.draw,
    slower: canonical.duration.considered,
    emphasis: canonical.duration.considered,
  },
  delay: {
    none: 0,
    subtle: canonical.stagger.item,
    base: canonical.beat.text,
    contextual: canonical.duration.instant,
    stagger: canonical.stagger.item,
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
  standard: canonical.ease.standard,
  enter: canonical.ease.enter,
  exit: canonical.ease.exit,
  emphasized: canonical.ease.enter,
};

export const spring = canonical.spring.responsive;

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
