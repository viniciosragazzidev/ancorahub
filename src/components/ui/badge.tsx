"use client";

import * as React from "react";
import { type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import {
  AnimatedBadge,
  type AnimatedBadgeProps,
  type AnimatedBadgeStatus,
  type AnimatedBadgeSize,
} from "@/components/motion/animated-badge";

const VARIANT_STATUS_MAP: Record<string, AnimatedBadgeStatus> = {
  default: "info",
  secondary: "neutral",
  success: "success",
  warning: "warning",
  destructive: "danger",
  info: "info",
  indigo: "info",
  purple: "neutral",
  pink: "neutral",
  cyan: "info",
  orange: "warning",
  outline: "neutral",
  ghost: "neutral",
  link: "info",
};

const VENANCOR_STATUS: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  info: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  loading: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export interface BadgeProps
  extends Omit<AnimatedBadgeProps, "status" | "size">,
    VariantProps<any> {
  variant?:
    | "default"
    | "secondary"
    | "success"
    | "warning"
    | "destructive"
    | "info"
    | "indigo"
    | "purple"
    | "pink"
    | "cyan"
    | "orange"
    | "outline"
    | "ghost"
    | "link"
    | null;
  status?: AnimatedBadgeStatus;
  size?: AnimatedBadgeSize;
  render?: any;
}

function Badge({
  className,
  variant = "default",
  status: explicitStatus,
  size = "sm",
  children,
  showIcon,
  pulse,
  icon,
  render,
  ...props
}: BadgeProps) {
  const status = explicitStatus ?? VARIANT_STATUS_MAP[variant ?? "default"] ?? "neutral";
  const resolvedShowIcon = showIcon ?? (explicitStatus != null || icon != null);

  return (
    <AnimatedBadge
      status={status}
      size={size}
      showIcon={resolvedShowIcon}
      pulse={pulse}
      icon={icon}
      className={cn("whitespace-nowrap rounded-full font-medium", VENANCOR_STATUS[status], className)}
      {...props}
    >
      {children}
    </AnimatedBadge>
  );
}

export { Badge, AnimatedBadge };
export type { AnimatedBadgeStatus, AnimatedBadgeSize, AnimatedBadgeProps };
