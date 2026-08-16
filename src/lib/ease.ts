import type { Transition } from "motion/react";

export const EASE_OUT = [0.16, 1, 0.3, 1] as const;
export const EASE_IN_OUT = [0.4, 0, 0.2, 1] as const;

export const SPRING_LAYOUT: Transition = {
  type: "spring",
  stiffness: 300,
  damping: 30,
  mass: 0.8,
};

export const SPRING_PRESS: Transition = {
  type: "spring",
  stiffness: 400,
  damping: 25,
};
