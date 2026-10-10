"use client";

import {
  AlertTriangle,
  Check,
  Circle,
  Info,
  LoaderCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type HTMLMotionProps,
  type Variants,
} from "motion/react";
import type { ReactNode } from "react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { motionTokens, transitions } from "@/lib/motion";
import { cn } from "@/lib/utils";

const EASE_OUT = motionTokens.easings.smoothOut;

export type AnimatedBadgeStatus =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "loading";

export type AnimatedBadgeSize = "sm" | "md";

export interface AnimatedBadgeProps extends Omit<
  HTMLMotionProps<"span">,
  "children"
> {
  status?: AnimatedBadgeStatus;
  size?: AnimatedBadgeSize;
  children?: ReactNode;
  icon?: ReactNode;
  showIcon?: boolean;
  pulse?: boolean;
  contentKey?: string | number;
}

const STATUS_CLASS: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-border bg-card text-muted-foreground",
  info: "border-primary/30 bg-primary/10 text-primary",
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  danger: "border-destructive/30 bg-destructive/10 text-destructive",
  loading: "border-primary/30 bg-primary/10 text-primary",
};

const SIZE_CLASS: Record<AnimatedBadgeSize, string> = {
  /* Lite/Arc badge: 22px (sm) and 26px (md) pills. */
  sm: "h-[22px] gap-1 px-2 text-[11px] tracking-[-.01em]",
  md: "h-[26px] gap-[5px] px-2.5 text-xs tracking-[-.01em]",
};

const ICON_CLASS: Record<AnimatedBadgeSize, string> = {
  sm: "h-3 w-3",
  md: "h-3.5 w-3.5",
};

const ICONS: Record<AnimatedBadgeStatus, LucideIcon> = {
  neutral: Circle,
  info: Info,
  success: Check,
  warning: AlertTriangle,
  danger: X,
  loading: LoaderCircle,
};

const ICON_ROLL_VARIANTS: Variants = {
  initial: {
    opacity: 0,
    scale: 0.92,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
  exit: {
    opacity: 0,
    scale: 0.92,
    transition: { duration: 0.15, ease: EASE_OUT },
  },
};

const TEXT_ROLL_VARIANTS: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.2, ease: EASE_OUT },
  },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE_OUT } },
};

export function AnimatedBadge({
  status = "neutral",
  size = "md",
  children,
  icon,
  showIcon = true,
  pulse = status === "loading",
  contentKey,
  className,
  ...rest
}: AnimatedBadgeProps) {
  const reduce = useReducedMotion();
  const motionEnabled = useInterfaceMotionEnabled() && !reduce;
  const Icon = ICONS[status];
  const resolvedContentKey =
    contentKey ??
    (typeof children === "string" || typeof children === "number"
      ? children
      : status);

  return (
    <motion.span
      layout={motionEnabled}
      transition={motionEnabled ? transitions.normal : { duration: 0 }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full border font-medium tabular-nums select-none",
        motionEnabled && "transition-colors duration-[var(--duration-fast)]",
        STATUS_CLASS[status],
        SIZE_CLASS[size],
        className,
      )}
      {...rest}
    >
      {pulse && motionEnabled ? (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-current opacity-10 pointer-events-none"
          animate={{ scale: [0.94, 1.08, 0.94], opacity: [0.08, 0.16, 0.08] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      ) : null}
      {showIcon ? (
        <span className="relative z-10 inline-flex items-center justify-center overflow-hidden shrink-0">
          <AnimatePresence mode="sync" initial={false}>
            <motion.span
              key={status}
              aria-hidden
              data-badge-icon
              variants={motionEnabled ? ICON_ROLL_VARIANTS : undefined}
              initial={motionEnabled ? "initial" : false}
              animate={motionEnabled ? "animate" : undefined}
              exit={motionEnabled ? "exit" : undefined}
              className="inline-flex"
            >
              {status === "loading" && motionEnabled && !icon ? (
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-flex"
                >
                  <Icon className={ICON_CLASS[size]} />
                </motion.span>
              ) : (
                (icon ?? <Icon className={ICON_CLASS[size]} />)
              )}
            </motion.span>
          </AnimatePresence>
        </span>
      ) : null}
      {children != null ? (
        <span className="relative z-10 inline-flex overflow-hidden">
          <AnimatePresence mode="sync" initial={false}>
            <motion.span
              key={resolvedContentKey}
              data-badge-label
              variants={motionEnabled ? TEXT_ROLL_VARIANTS : undefined}
              initial={motionEnabled ? "initial" : false}
              animate={motionEnabled ? "animate" : undefined}
              exit={motionEnabled ? "exit" : undefined}
              className="inline-flex items-center gap-1.5"
            >
              {children}
            </motion.span>
          </AnimatePresence>
        </span>
      ) : null}
    </motion.span>
  );
}
