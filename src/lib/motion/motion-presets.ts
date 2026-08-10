import { Variants } from "motion/react";
import { motionTokens } from "./motion-tokens";

/**
 * Motion Presets Reutilizáveis do AncoraHub
 * 
 * Evita duplicação de variantes em componentes individuais.
 * Todos os presets integram por padrão transições baseadas nos tokens centrais.
 */

export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: motionTokens.duration.normal, ease: motionTokens.easings.smoothOut } },
  exit: { opacity: 0, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easings.easeInOut } },
};

export const fadeUp: Variants = {
  initial: { opacity: 0, y: motionTokens.distance.md },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.normal, ease: motionTokens.easings.smoothOut } },
  exit: { opacity: 0, y: -motionTokens.distance.sm, transition: { duration: motionTokens.duration.fast } },
};

export const scaleFade: Variants = {
  initial: { opacity: 0, scale: motionTokens.scale.enter },
  animate: { opacity: 1, scale: 1, transition: { duration: motionTokens.duration.fast, ease: motionTokens.easings.smoothOut } },
  exit: { opacity: 0, scale: motionTokens.scale.enter, transition: { duration: motionTokens.duration.instant } },
};

export const slideInRight: Variants = {
  initial: { opacity: 0, x: motionTokens.distance.xl },
  animate: { opacity: 1, x: 0, transition: { duration: motionTokens.duration.normal, ease: motionTokens.easings.smoothOut } },
  exit: { opacity: 0, x: motionTokens.distance.xl, transition: { duration: motionTokens.duration.fast } },
};

export const slideInBottom: Variants = {
  initial: { opacity: 0, y: motionTokens.distance.xl },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.normal, ease: motionTokens.easings.smoothOut } },
  exit: { opacity: 0, y: motionTokens.distance.xl, transition: { duration: motionTokens.duration.fast } },
};

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
  exit: {
    transition: {
      staggerChildren: 0.02,
      staggerDirection: -1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: motionTokens.distance.sm },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast } },
  exit: { opacity: 0, y: -motionTokens.distance.xs, transition: { duration: motionTokens.duration.instant } },
};
