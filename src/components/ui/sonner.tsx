"use client";

import { Toaster as Sonner, toast as sonnerToast, type ToasterProps } from "sonner";
import { AnimatedToast } from "@/components/motion/animated-toast";
import React from "react";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="bottom-right"
      closeButton={false}
      duration={4500}
      gap={10}
      visibleToasts={4}
      className="ct-toaster"
      toastOptions={{
        className: "ct-toast group font-sans pointer-events-auto",
        style: {
          border: "none",
          boxShadow: "none",
          padding: 0,
          width: "auto",
          background: "transparent",
        },
      }}
      {...props}
    />
  );
};

/** Internal helper to render AnimatedToast via sonnerToast.custom */
function renderToast(
  status: "info" | "success" | "danger" | "warning" | "loading" | "neutral",
  defaultBadge: string,
  message: React.ReactNode,
  options?: any,
) {
  if (typeof sonnerToast?.custom === "function") {
    // Strip properties that AnimatedToast renders internally so Sonner does not duplicate them outside
    const { description, badgeLabel, action, cancel, ...sonnerOptions } = options || {};

    return sonnerToast.custom(
      (t) => (
        <AnimatedToast
          id={t}
          status={status}
          title={message}
          description={description}
          badgeLabel={badgeLabel ?? defaultBadge}
          action={action}
          cancel={cancel}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ),
      sonnerOptions,
    );
  }

  // Fallback for environments / test runners where sonner is partially mocked without .custom
  const fallbackFn =
    status === "success"
      ? sonnerToast?.success
      : status === "danger"
        ? sonnerToast?.error
        : status === "warning"
          ? sonnerToast?.warning
          : status === "loading"
            ? sonnerToast?.loading
            : sonnerToast?.info ?? sonnerToast?.message ?? (typeof sonnerToast === "function" ? sonnerToast : undefined);

  if (typeof fallbackFn === "function") {
    return options !== undefined ? fallbackFn(message, options) : fallbackFn(message);
  }
}

export const toast = Object.assign(
  (message: React.ReactNode, options?: any) =>
    renderToast("info", "Notificação", message, options),
  {
    ...sonnerToast,
    success: (message: React.ReactNode, options?: any) =>
      renderToast("success", "Sucesso", message, options),
    error: (message: React.ReactNode, options?: any) =>
      renderToast("danger", "Erro", message, options),
    warning: (message: React.ReactNode, options?: any) =>
      renderToast("warning", "Aviso", message, options),
    info: (message: React.ReactNode, options?: any) =>
      renderToast("info", "Info", message, options),
    loading: (message: React.ReactNode, options?: any) =>
      renderToast("loading", "Carregando", message, options),
    /** Alias for generic messages without strong semantic status */
    message: (message: React.ReactNode, options?: any) =>
      renderToast("neutral", "Notificação", message, options),
  },
);

export { Toaster, AnimatedToast };
