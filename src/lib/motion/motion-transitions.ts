import { Transition } from "motion/react";
import { motionTokens } from "./motion-tokens";

/**
 * Transições pré-configuradas para componentes estáticos e interativos.
 */

export const transitions = {
  instant: { duration: motionTokens.duration.instant, ease: motionTokens.easings.easeInOut } as Transition,
  fast: { duration: motionTokens.duration.fast, ease: motionTokens.easings.smoothOut } as Transition,
  normal: { duration: motionTokens.duration.normal, ease: motionTokens.easings.smoothOut } as Transition,
  deliberate: { duration: motionTokens.duration.deliberate, ease: motionTokens.easings.smoothOut } as Transition,
  springSoft: motionTokens.spring.soft as Transition,
  springResponsive: motionTokens.spring.responsive as Transition,
  springBouncy: motionTokens.spring.bouncy as Transition,
};
