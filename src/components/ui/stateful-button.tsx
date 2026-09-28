"use client";

import { type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";

import { cn } from "@/lib/utils";
import { buttonVariants, type ButtonVariants } from "./button-variants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonState = "idle" | "loading" | "success" | "error";

type CleanButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
>;

export interface StatefulButtonProps
  extends CleanButtonProps,
    ButtonVariants {
  /** Current state of the button. */
  state?: ButtonState;
  /** Icon displayed in idle state (end slot). */
  icon?: ReactNode;
  /** Text shown while loading. */
  loadingText?: ReactNode;
  /** Text shown on success. */
  successText?: ReactNode;
  /** Text shown on error. */
  errorText?: ReactNode;
  /** Override press scale (default 0.97). */
  pressScale?: number;
}

// ---------------------------------------------------------------------------
// Slot content per state
// ---------------------------------------------------------------------------

const stateIcon: Record<ButtonState, ReactNode> = {
  idle: null,
  loading: <Loader className="size-4 animate-spin" />,
  success: <CheckCircle className="size-4" />,
  error: <XCircle className="size-4" />,
};

const pressTransition = {
  type: "spring" as const,
  stiffness: 600,
  damping: 28,
  mass: 0.8,
};

const swapVariants = {
  initial: { opacity: 0, filter: "blur(4px)", y: 6 },
  animate: { opacity: 1, filter: "blur(0px)", y: 0 },
  exit: { opacity: 0, filter: "blur(4px)", y: -6 },
};

// ---------------------------------------------------------------------------
// StatefulButton
// ---------------------------------------------------------------------------

export function StatefulButton({
  state = "idle",
  children,
  icon,
  loadingText = "Aguarde…",
  successText = "Concluído",
  errorText = "Tentar novamente",
  variant = "default",
  size = "default",
  pressScale = 0.97,
  className,
  disabled,
  ...props
}: StatefulButtonProps) {
  const reduce = useReducedMotion();
  const motionEnabled = useInterfaceMotionEnabled() && !reduce;
  const isPendingOrComplete = state === "loading" || state === "success";

  const stateContent: Record<ButtonState, ReactNode> = {
    idle: (
      <span className="flex items-center gap-2">
        {children}
        {icon}
      </span>
    ),
    loading: (
      <span className="flex items-center gap-2">
        {stateIcon.loading}
        {loadingText}
      </span>
    ),
    success: (
      <span className="flex items-center gap-2">
        {stateIcon.success}
        {successText}
      </span>
    ),
    error: (
      <span className="flex items-center gap-2">
        {stateIcon.error}
        {errorText}
      </span>
    ),
  };

  return (
    <motion.button
      data-slot="button"
      data-state={state}
      type="button"
      disabled={disabled || isPendingOrComplete}
      aria-busy={state === "loading"}
      className={cn(
        buttonVariants({ variant, size }),
        "relative overflow-hidden",
        state === "success" && "bg-success border-success text-success-foreground",
        state === "error" && "bg-destructive/10 text-destructive border-destructive/20",
        className,
      )}
      whileTap={motionEnabled ? { scale: pressScale } : undefined}
      transition={motionEnabled ? pressTransition : { duration: 0 }}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          variants={motionEnabled ? swapVariants : undefined}
          initial={motionEnabled ? "initial" : false}
          animate={motionEnabled ? "animate" : undefined}
          exit={motionEnabled ? "exit" : undefined}
          transition={motionEnabled ? { duration: 0.15, ease: [0.16, 1, 0.3, 1] } : { duration: 0 }}
          className="flex items-center gap-2 whitespace-nowrap"
        >
          {stateContent[state]}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}
