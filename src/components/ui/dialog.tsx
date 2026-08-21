"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />
}

function DialogOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/28 backdrop-blur-sm transition-[background-color,backdrop-filter,opacity] duration-[var(--dialog-overlay-duration)] ease-[var(--dialog-ease)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function DialogPopup({
  className,
  children,
  overlayClassName,
  ...props
}: DialogPrimitive.Popup.Props & { overlayClassName?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay className={overlayClassName} />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
        "fixed left-[50%] top-[50%] z-50 grid max-h-[calc(100dvh-2rem)] min-h-0 w-[calc(100%-2rem)] max-w-lg translate-x-[-50%] translate-y-[-50%] gap-[var(--size-spacing-04)] overflow-visible rounded-[var(--radius-panel)] border border-border/80 bg-popover p-[var(--size-spacing-05)] text-popover-foreground shadow-[var(--shadow-dialog)] transition-[opacity,transform] duration-[var(--dialog-content-duration)] ease-[var(--dialog-ease)] data-ending-style:opacity-0 data-starting-style:opacity-0 data-ending-style:scale-[0.985] data-starting-style:scale-[0.985] motion-reduce:transition-none sm:w-full sm:p-[var(--size-spacing-06)] [&>*]:min-w-0",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-panel"
      className={cn("grid min-h-0 gap-[var(--size-spacing-04)]", className)}
      {...props}
    />
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex min-w-0 flex-col space-y-1 text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex flex-col-reverse border-t border-border/70 pt-[var(--size-spacing-04)] sm:flex-row sm:justify-end sm:space-x-[var(--size-spacing-02)]", className)}
      {...props}
    />
  )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg font-bold leading-snug tracking-tight text-foreground font-sans", className)}
      {...props}
    />
  )
}

function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-xs leading-relaxed text-muted-foreground font-sans", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogPopup,
  DialogPanel,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
