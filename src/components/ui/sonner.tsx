"use client";

import { Toaster as Sonner, toast as sonnerToast, type ToasterProps } from "sonner";
import { AnimatedBadge } from "@/components/motion/animated-badge";
import { AnimatedToast } from "@/components/motion/animated-toast";
import React from "react";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      closeButton
      duration={4000}
      gap={12}
      visibleToasts={4}
      className="ct-toaster group"
      icons={{
        success: <AnimatedBadge status="success" size="sm" showIcon pulse={false} />,
        info: <AnimatedBadge status="info" size="sm" showIcon pulse={false} />,
        warning: <AnimatedBadge status="warning" size="sm" showIcon pulse={false} />,
        error: <AnimatedBadge status="danger" size="sm" showIcon pulse={false} />,
        loading: <AnimatedBadge status="loading" size="sm" showIcon pulse />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "ct-toast rounded-[var(--radius-card)] border border-border/80 p-3 text-xs font-medium shadow-[var(--shadow-dialog)] backdrop-blur-md",
          title: "ct-toast__title font-semibold text-xs",
          description: "ct-toast__description text-[11px] text-muted-foreground",
          icon: "ct-toast__icon",
          content: "ct-toast__content",
          closeButton: "ct-toast__close rounded-[var(--radius-control)] p-1 opacity-70 hover:opacity-100",
          actionButton: "ct-toast__action rounded-full bg-primary px-2.5 py-1 text-xs text-primary-foreground",
          cancelButton: "ct-toast__cancel rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground",
          success: "ct-toast--success border-emerald-500/25 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100",
          error: "ct-toast--error border-destructive/25 bg-destructive/5 text-destructive-foreground",
          info: "ct-toast--info border-primary/25 bg-primary/5 text-foreground",
          warning: "ct-toast--warning border-amber-500/25 bg-amber-500/5 text-amber-950 dark:text-amber-100",
          loading: "ct-toast--loading border-primary/25 bg-primary/5 text-foreground",
          default: "ct-toast--default bg-card text-card-foreground",
        },
      }}
      {...props}
    />
  );
};

export const toast = Object.assign(
  (message: React.ReactNode, options?: any) => sonnerToast(message, options),
  {
    ...sonnerToast,
    success: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom((t) => (
        <AnimatedToast
          id={t}
          status="success"
          title={message}
          description={options?.description}
          badgeLabel={options?.badgeLabel ?? "Sucesso"}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ), options),
    error: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom((t) => (
        <AnimatedToast
          id={t}
          status="danger"
          title={message}
          description={options?.description}
          badgeLabel={options?.badgeLabel ?? "Erro"}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ), options),
    warning: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom((t) => (
        <AnimatedToast
          id={t}
          status="warning"
          title={message}
          description={options?.description}
          badgeLabel={options?.badgeLabel ?? "Aviso"}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ), options),
    info: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom((t) => (
        <AnimatedToast
          id={t}
          status="info"
          title={message}
          description={options?.description}
          badgeLabel={options?.badgeLabel ?? "Info"}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ), options),
    loading: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom((t) => (
        <AnimatedToast
          id={t}
          status="loading"
          title={message}
          description={options?.description}
          badgeLabel={options?.badgeLabel ?? "Carregando"}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ), options),
  }
);

export { Toaster, AnimatedToast };
