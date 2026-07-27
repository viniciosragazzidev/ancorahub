import type { Variants } from "motion/react";

export const pageTransitionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2, ease: [0, 0, 0.2, 1] } },
  exit: { opacity: 0, transition: { duration: 0.12, ease: [0, 0, 0.2, 1] } },
};

export const cardGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const cardItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.18, ease: [0, 0, 0.2, 1] },
  },
};
