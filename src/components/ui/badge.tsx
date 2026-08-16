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
  showIcon = true,
  pulse,
  icon,
  render,
  ...props
}: BadgeProps) {
  const status = explicitStatus ?? VARIANT_STATUS_MAP[variant ?? "default"] ?? "neutral";

  return (
    <AnimatedBadge
      status={status}
      size={size}
      showIcon={showIcon}
      pulse={pulse}
      icon={icon}
      className={cn("whitespace-nowrap font-medium", className)}
      {...props}
    >
      {children}
    </AnimatedBadge>
  );
}

export { Badge, AnimatedBadge };
export type { AnimatedBadgeStatus, AnimatedBadgeSize, AnimatedBadgeProps };
