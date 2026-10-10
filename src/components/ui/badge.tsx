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

/* Lite/Arc badge tints (src/components/arc/badge): status color at 10-11% on the surface, 25-27% on the border. */
const VENANCOR_STATUS: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-border bg-muted text-[var(--text-secondary)]",
  info: "border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-primary",
  success: "border-[color-mix(in_oklab,var(--success)_25%,var(--border))] bg-[color-mix(in_oklab,var(--success)_10%,var(--card))] text-success",
  warning: "border-[color-mix(in_oklab,var(--warning)_27%,var(--border))] bg-[color-mix(in_oklab,var(--warning)_11%,var(--card))] text-warning",
  danger: "border-[color-mix(in_oklab,var(--destructive)_26%,var(--border))] bg-[color-mix(in_oklab,var(--destructive)_10%,var(--card))] text-destructive",
  loading: "border-[color-mix(in_oklab,var(--primary)_24%,var(--border))] bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] text-primary",
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
