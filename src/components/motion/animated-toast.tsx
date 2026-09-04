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
  cancel?: {
    label: string;
    onClick: () => void;
  };
  onClose?: () => void;
  className?: string;
}

const STATUS_BORDER: Record<AnimatedBadgeStatus, string> = {
  neutral: "border-border/90",
  info: "border-blue-500/40 dark:border-blue-400/40 ring-1 ring-blue-500/10",
  success: "border-emerald-500/40 dark:border-emerald-400/40 ring-1 ring-emerald-500/10",
  warning: "border-amber-500/40 dark:border-amber-400/40 ring-1 ring-amber-500/10",
  danger: "border-red-500/40 dark:border-red-400/40 ring-1 ring-red-500/10",
  loading: "border-blue-500/40 dark:border-blue-400/40 ring-1 ring-blue-500/10",
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
      style={{
        backgroundColor: "var(--popover, #ffffff)",
        color: "var(--popover-foreground, #1e1e1e)",
        boxShadow:
          "0 12px 36px -4px rgba(0, 0, 0, 0.16), 0 4px 12px -2px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)",
      }}
      className={cn(
        "group pointer-events-auto relative flex w-[360px] max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border p-3.5 transition-all select-none shadow-2xl backdrop-blur-md",
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
        {(action || cancel) ? (
          <div className="flex items-center gap-2 pt-1">
            {action ? (
              <button
                type="button"
                onClick={action.onClick}
                className="inline-flex items-center rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-all hover:bg-primary/90 focus-visible:outline-none cursor-pointer pointer-events-auto"
              >
                {action.label}
              </button>
            ) : null}
            {cancel ? (
              <button
                type="button"
                onClick={cancel.onClick}
                className="inline-flex items-center rounded-md border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground focus-visible:outline-none cursor-pointer pointer-events-auto"
              >
                {cancel.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="relative z-30 shrink-0 -mr-1 -mt-1 flex size-7 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring pointer-events-auto"
          aria-label="Fechar notificação"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </motion.div>
  );
}
