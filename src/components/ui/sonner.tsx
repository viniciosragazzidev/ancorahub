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
      className="ct-toaster group"
      toastOptions={{
        className: "group toast font-sans",
        style: {
          background: "transparent",
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

export const toast = Object.assign(
  (message: React.ReactNode, options?: any) =>
    sonnerToast.custom(
      (t) => (
        <AnimatedToast
          id={t}
          status="info"
          title={message}
          description={options?.description}
          badgeLabel={options?.badgeLabel ?? "Notificação"}
          action={options?.action}
          onClose={() => sonnerToast.dismiss(t)}
        />
      ),
      options,
    ),
  {
    ...sonnerToast,
    success: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom(
        (t) => (
          <AnimatedToast
            id={t}
            status="success"
            title={message}
            description={options?.description}
            badgeLabel={options?.badgeLabel ?? "Sucesso"}
            action={options?.action}
            onClose={() => sonnerToast.dismiss(t)}
          />
        ),
        options,
      ),
    error: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom(
        (t) => (
          <AnimatedToast
            id={t}
            status="danger"
            title={message}
            description={options?.description}
            badgeLabel={options?.badgeLabel ?? "Erro"}
            action={options?.action}
            onClose={() => sonnerToast.dismiss(t)}
          />
        ),
        options,
      ),
    warning: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom(
        (t) => (
          <AnimatedToast
            id={t}
            status="warning"
            title={message}
            description={options?.description}
            badgeLabel={options?.badgeLabel ?? "Aviso"}
            action={options?.action}
            onClose={() => sonnerToast.dismiss(t)}
          />
        ),
        options,
      ),
    info: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom(
        (t) => (
          <AnimatedToast
            id={t}
            status="info"
            title={message}
            description={options?.description}
            badgeLabel={options?.badgeLabel ?? "Info"}
            action={options?.action}
            onClose={() => sonnerToast.dismiss(t)}
          />
        ),
        options,
      ),
    loading: (message: React.ReactNode, options?: any) =>
      sonnerToast.custom(
        (t) => (
          <AnimatedToast
            id={t}
            status="loading"
            title={message}
            description={options?.description}
            badgeLabel={options?.badgeLabel ?? "Carregando"}
            action={options?.action}
            onClose={() => sonnerToast.dismiss(t)}
          />
        ),
        options,
      ),
  },
);

export { Toaster, AnimatedToast };
