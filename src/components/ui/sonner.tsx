"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon, XIcon } from "@/components/huge-icons"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      position="top-right"
      closeButton
      duration={4000}
      gap={12}
      visibleToasts={3}
      className="ct-toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
        close: <XIcon className="size-3" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "ct-toast",
          title: "ct-toast__title",
          description: "ct-toast__description",
          icon: "ct-toast__icon",
          content: "ct-toast__content",
          closeButton: "ct-toast__close",
          actionButton: "ct-toast__action",
          cancelButton: "ct-toast__cancel",
          success: "ct-toast--success",
          error: "ct-toast--error",
          info: "ct-toast--info",
          warning: "ct-toast--warning",
          loading: "ct-toast--loading",
          default: "ct-toast--default",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
