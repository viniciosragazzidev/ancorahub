"use client";

import * as React from "react";
import { motion, useReducedMotion, type MotionProps } from "motion/react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./button-variants";

// ---------------------------------------------------------------------------
// Spring config
// ---------------------------------------------------------------------------

const pressTransition = {
  type: "spring" as const,
  stiffness: 600,
  damping: 28,
  mass: 0.8,
};

const createMotionSlot = () => {
  if (typeof motion !== "undefined" && typeof (motion as any).create === "function") {
    return (motion as any).create(Slot);
  }
  if (typeof motion === "function") {
    return (motion as any)(Slot);
  }
  return Slot;
};
const MotionSlot = createMotionSlot();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NativeButtonProps = Omit<
  React.ComponentPropsWithoutRef<"button"> & MotionProps,
  "ref"
>;

export interface ButtonProps extends NativeButtonProps, ButtonVariants {
  /**
   * Render the button as a different element (e.g. Next.js <Link>).
   * The render element receives the button's className, onClick and children.
   * Compatible with the @base-ui `render` prop pattern.
   */
  render?: React.ReactElement<Record<string, unknown>>;
  /** Use Radix asChild pattern instead of render prop. */
  asChild?: boolean;
  /** Spring press scale override. Default 0.97. */
  pressScale?: number;
}

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "default",
      size = "default",
      render,
      asChild = false,
      pressScale = 0.97,
      children,
      // absorb any lingering motion overrides from callers
      whileTap: _whileTap,
      whileHover: _whileHover,
      transition: _transition,
      ...restProps
    },
    ref,
  ) {
    const reduce = useReducedMotion();

    const mergedClass = cn(buttonVariants({ variant, size }), className);

    const motionProps = reduce
      ? {}
      : {
          whileTap: { scale: pressScale },
          whileHover: { y: -1 },
          transition: pressTransition,
        };

    // -------------------------------------------------------------------------
    // render-prop path  →  <Button render={<Link href="/..." />}>label</Button>
    // -------------------------------------------------------------------------
    if (render && React.isValidElement(render)) {
      // Strip className from the render element — the merged one wins.
      // Strip `type` so native button type="button" doesn't land on <a>.
      const { className: _rc, type: _rt, ...renderOwnProps } = render.props as {
        className?: string;
        type?: string;
        [key: string]: unknown;
      };

      // restProps may contain `type` (default "button") — must not reach Link.
      const { type: _bt, ...safeRestProps } = restProps as {
        type?: string;
        [key: string]: unknown;
      };

      // Slot merges safeRestProps (onClick, disabled, aria-*, data-*, …) onto
      // the render element and animates the resulting DOM node.
      return (
        <MotionSlot
          ref={ref as React.Ref<HTMLElement>}
          data-slot="button"
          className={mergedClass}
          {...motionProps}
          {...safeRestProps}
        >
          {React.cloneElement(render, renderOwnProps, children)}
        </MotionSlot>
      );
    }

    // -------------------------------------------------------------------------
    // asChild path  →  <Button asChild><Link href="/...">label</Link></Button>
    // -------------------------------------------------------------------------
    if (asChild) {
      const { type: _bt, ...safeRestProps } = restProps as {
        type?: string;
        [key: string]: unknown;
      };
      return (
        <MotionSlot
          ref={ref as React.Ref<HTMLElement>}
          data-slot="button"
          className={mergedClass}
          {...motionProps}
          {...safeRestProps}
        >
          {children}
        </MotionSlot>
      );
    }

    // -------------------------------------------------------------------------
    // Native button (default path)
    // -------------------------------------------------------------------------
    return (
      <motion.button
        ref={ref}
        data-slot="button"
        type={
          (restProps as React.ButtonHTMLAttributes<HTMLButtonElement>).type ??
          "button"
        }
        className={mergedClass}
        {...motionProps}
        {...restProps}
      >
        {children}
      </motion.button>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
