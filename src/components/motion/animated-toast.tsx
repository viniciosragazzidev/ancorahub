"use client";

import React, { ReactNode } from "react";
import { X } from "lucide-react";
import { transitions } from "@/lib/motion";
import { motion, useReducedMotion } from "motion/react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import {
  AnimatedBadge,
  type AnimatedBadgeStatus,
} from "@/components/motion/animated-badge";
import { cn } from "@/lib/utils";

export interface AnimatedToastProps {
  id?: string | number;
  status?: AnimatedBadgeStatus;
  title: ReactNode;
  description?: ReactNode;
  badgeLabel?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  className?: string;
}

const STATUS_ACCENTS: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-border/80",
  info: "border-blue-500/35 dark:border-blue-400/35 ring-1 ring-blue-500/10",
  success: "border-emerald-500/35 dark:border-emerald-400/35 ring-1 ring-emerald-500/10",
  warning: "border-amber-500/35 dark:border-amber-400/35 ring-1 ring-amber-500/10",
  danger: "border-red-500/35 dark:border-red-400/35 ring-1 ring-red-500/10",
  loading: "border-blue-500/35 dark:border-blue-400/35 ring-1 ring-blue-500/10",
};

export function AnimatedToast({
  status = "neutral",
  title,
  description,
  badgeLabel,
  action,
  cancel,
  onClose,
  className,
}: AnimatedToastProps) {
  const reduce = useReducedMotion();
  const motionEnabled = useInterfaceMotionEnabled() && !reduce;

  const label =
    badgeLabel ??
    (status === "success"
      ? "Sucesso"
      : status === "danger"
      ? "Erro"
      : status === "warning"
      ? "Aviso"
      : status === "info"
      ? "Info"
      : status === "loading"
      ? "Carregando"
      : "Notificação");

  return (
    <motion.div
      data-slot="animated-toast"
      data-status={status}
      initial={motionEnabled ? { opacity: 0 } : false}
      animate={{ opacity: 1 }}
      exit={motionEnabled ? { opacity: 0, transition: transitions.fast } : undefined}
      transition={motionEnabled ? transitions.normal : { duration: 0 }}
      className={cn(
        "group pointer-events-auto relative flex w-[380px] sm:w-[420px] max-w-[calc(100vw-2rem)] flex-col gap-2.5 rounded-2xl border bg-popover/95 p-4 text-popover-foreground shadow-2xl backdrop-blur-xl select-none",
        motionEnabled && "transition-colors",
        "shadow-[0_12px_36px_-4px_rgba(0,0,0,0.16),0_4px_12px_-2px_rgba(0,0,0,0.08)] dark:shadow-[0_16px_40px_-6px_rgba(0,0,0,0.55)]",
        STATUS_ACCENTS[status],
        className
      )}
    >
      {/* Top row: Status Badge + Close Button */}
      <div className="flex items-center justify-between gap-2">
        <AnimatedBadge status={status} size="sm" pulse={motionEnabled && status === "loading"}>
          {label}
        </AnimatedBadge>

        {onClose ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="flex size-6 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pointer-events-auto"
            aria-label="Fechar notificação"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Main Content: Title & Description */}
      <div className="space-y-1">
        <div className="text-xs font-semibold leading-snug text-foreground">
          {title}
        </div>
        {description ? (
          <div className="text-[11px] leading-relaxed text-muted-foreground">
            {description}
          </div>
        ) : null}
      </div>

      {/* Action Buttons Row */}
      {(action || cancel) ? (
        <div className="flex items-center gap-2 pt-1">
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 ct-press focus-visible:outline-none cursor-pointer pointer-events-auto whitespace-nowrap shrink-0"
            >
              {action.label}
            </button>
          ) : null}
          {cancel ? (
            <button
              type="button"
              onClick={cancel.onClick}
              className="inline-flex items-center justify-center rounded-lg border border-border/80 bg-muted/40 px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted hover:text-foreground ct-press focus-visible:outline-none cursor-pointer pointer-events-auto whitespace-nowrap shrink-0"
            >
              {cancel.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </motion.div>
  );
}
