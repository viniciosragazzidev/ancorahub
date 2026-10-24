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
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LEGACY_ANIMATED_STATUS_CLASS } from "@/components/ui/legacy-badge-classes";

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

const SIZE_CLASS: Record<AnimatedBadgeSize, string> = {
  sm: "h-6 gap-1.5 px-2 text-[11px]",
  md: "h-8 gap-2 px-3 text-xs",
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
  const directorLite = useArcScopeEnabled();
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
      data-slot={directorLite ? "animated-badge" : undefined}
      data-status={directorLite ? status : undefined}
      layout={motionEnabled}
      transition={motionEnabled ? transitions.normal : { duration: 0 }}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden whitespace-nowrap rounded-full border font-medium tabular-nums select-none",
        motionEnabled && "transition-colors duration-[var(--duration-fast)]",
        !directorLite && LEGACY_ANIMATED_STATUS_CLASS[status],
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
