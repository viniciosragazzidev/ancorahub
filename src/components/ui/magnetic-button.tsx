"use client";

import { useRef, type ReactNode } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./button-variants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CleanButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>;

export interface MagneticButtonProps
  extends CleanButtonProps,
    ButtonVariants {
  children: ReactNode;
  /** Magnetic pull strength (0–1). Default 0.25. */
  strength?: number;
  /** Class applied to the outer magnetic wrapper div. */
  magneticClassName?: string;
  /** Override press scale. Default 0.97. */
  pressScale?: number;
}

// ---------------------------------------------------------------------------
// MagneticButton
// ---------------------------------------------------------------------------

export function MagneticButton({
  children,
  strength = 0.25,
  magneticClassName,
  pressScale = 0.97,
  variant = "default",
  size = "default",
  className,
  ...props
}: MagneticButtonProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);

  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);

  const x = useSpring(rawX, { stiffness: 220, damping: 22, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 220, damping: 22, mass: 0.6 });

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    rawX.set((e.clientX - cx) * strength);
    rawY.set((e.clientY - cy) * strength);
  }

  function handleMouseLeave() {
    rawX.set(0);
    rawY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={cn("inline-flex", magneticClassName)}
      style={reduce ? undefined : { x, y }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <motion.button
        data-slot="button"
        type="button"
        className={cn(buttonVariants({ variant, size }), className)}
        whileTap={reduce ? undefined : { scale: pressScale }}
        transition={{ type: "spring", stiffness: 600, damping: 28, mass: 0.8 }}
        {...props}
      >
        {children}
      </motion.button>
    </motion.div>
  );
}
