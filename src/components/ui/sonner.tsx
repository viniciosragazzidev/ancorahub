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
        className: "group toast font-sans",
        style: {
          border: "none",
          boxShadow: "none",
          padding: 0,
          width: "auto",
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
  return sonnerToast.custom(
    (t) => (
      <AnimatedToast
        id={t}
        status={status}
        title={message}
        description={options?.description}
        badgeLabel={options?.badgeLabel ?? defaultBadge}
        action={options?.action}
        cancel={options?.cancel}
        onClose={() => sonnerToast.dismiss(t)}
      />
    ),
    options,
  );
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
