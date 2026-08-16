"use client";

import * as React from "react";
import { motion, useReducedMotion, type MotionProps } from "motion/react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./button-variants";

// ---------------------------------------------------------------------------
// Spring transition for press — subtly alive, never flashy
// ---------------------------------------------------------------------------

const pressTransition = {
  type: "spring" as const,
  stiffness: 600,
  damping: 28,
  mass: 0.8,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MotionButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button"> & MotionProps,
  "ref"
>;

export interface ButtonProps extends MotionButtonProps, ButtonVariants {
  /** Pass a React element (e.g. <Link>) to render the button as that element. */
  render?: React.ReactElement<any>;
  /** Override the press scale (default 0.97). */
  pressScale?: number;
  /** Use asChild pattern (Radix Slot) instead of render prop. */
  asChild?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "default",
    size = "default",
    render,
    asChild = false,
    pressScale = 0.97,
    whileTap,
    whileHover,
    transition,
    ...props
  },
  ref,
) {
  const reduce = useReducedMotion();

  if (render && React.isValidElement(render)) {
    const element = render as React.ReactElement<{
      className?: string;
      [key: string]: unknown;
    }>;
    const merged = cn(
      buttonVariants({ variant, size }),
      className,
      element.props.className,
    );
    const MotionSlot = typeof motion.create === "function" ? motion.create(Slot) : typeof motion === "function" ? (motion as unknown as (c: typeof Slot) => typeof Slot)(Slot) : Slot;
    return (
      <MotionSlot
        ref={ref}
        data-slot="button"
        className={merged}
        whileTap={reduce ? undefined : { scale: pressScale }}
        whileHover={reduce ? undefined : { y: -1 }}
        transition={pressTransition}
        {...(props as Record<string, unknown>)}
      >
        {React.cloneElement(element, {
          className: undefined,
        })}
      </MotionSlot>
    );
  }

  if (asChild) {
    const MotionSlot = typeof motion.create === "function" ? motion.create(Slot) : typeof motion === "function" ? (motion as unknown as (c: typeof Slot) => typeof Slot)(Slot) : Slot;
    return (
      <MotionSlot
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        whileTap={reduce ? undefined : { scale: pressScale }}
        whileHover={reduce ? undefined : { y: -1 }}
        transition={pressTransition}
        {...(props as Record<string, unknown>)}
      />
    );
  }

  return (
    <motion.button
      ref={ref}
      data-slot="button"
      type={(props as React.ButtonHTMLAttributes<HTMLButtonElement>).type ?? "button"}
      className={cn(buttonVariants({ variant, size }), className)}
      whileTap={reduce ? undefined : { scale: pressScale }}
      whileHover={reduce ? undefined : { y: -1 }}
      transition={pressTransition}
      {...props}
    />
  );
});

export { Button, buttonVariants };
