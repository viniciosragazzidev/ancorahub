"use client";

import React, { ReactNode } from "react";
import { X } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
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
  onClose?: () => void;
  className?: string;
}

const STATUS_BORDER: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-border/80",
  info: "border-primary/30",
  success: "border-emerald-500/30",
  warning: "border-amber-500/30",
  danger: "border-destructive/30",
  loading: "border-primary/30",
};

export function AnimatedToast({
  status = "neutral",
  title,
  description,
  badgeLabel,
  action,
  onClose,
  className,
}: AnimatedToastProps) {
  const reduce = useReducedMotion();

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
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.95, filter: "blur(4px)" }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.95, filter: "blur(4px)" }}
      transition={{ type: "spring", stiffness: 420, damping: 28, mass: 0.8 }}
      className={cn(
        "group relative flex w-full max-w-sm items-start gap-3 rounded-xl border p-3.5 transition-all select-none bg-card text-card-foreground shadow-2xl border-border/90",
        STATUS_BORDER[status],
        className
      )}
    >
      <div className="shrink-0 pt-0.5">
        <AnimatedBadge status={status} size="sm" pulse={status === "loading"}>
          {label}
        </AnimatedBadge>
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-xs font-semibold leading-relaxed text-foreground">
          {title}
        </div>
        {description ? (
          <div className="text-[11px] leading-normal text-muted-foreground">
            {description}
          </div>
        ) : null}
        {action ? (
          <div className="pt-1">
            <button
              type="button"
              onClick={action.onClick}
              className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none cursor-pointer"
            >
              {action.label}
            </button>
          </div>
        ) : null}
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:text-foreground hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
          aria-label="Fechar notificação"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </motion.div>
  );
}
