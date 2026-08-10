import type { Transition, Variants } from "motion/react";
import { motionTokens } from "./motion/motion-tokens";
import { fade, fadeUp } from "./motion/motion-presets";

export * from "./motion/motion-tokens";
export * from "./motion/motion-presets";
export * from "./motion/motion-transitions";
export * from "./motion/motion-utils";

/** Aliases para retrocompatibilidade com código existente */
export const defaultTransition: Transition = {
  duration: motionTokens.duration.normal,
  ease: motionTokens.easings.smoothOut,
};

export const fadeIn: Variants = fade;
export const slideFadeUp: Variants = fadeUp;
export const slideFadeDown: Variants = fadeUp;

export const scaleIn: Variants = fade;

