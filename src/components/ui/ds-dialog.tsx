"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/utils/core/cn";

/**
 * Dialog / Modal — docs/design-system.md § Dialog / Modal.
 * Re-skins the project's existing @base-ui/react/dialog primitive (a11y,
 * focus trap, portal, esc-to-close already solved there) with Ds tokens
 * instead of building overlay/focus behavior from scratch.
 */
const DsDialog = DialogPrimitive.Root;
const DsDialogTrigger = DialogPrimitive.Trigger;
const DsDialogClose = DialogPrimitive.Close;

function DsDialogPopup({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="ds-dialog-overlay"
        className="fixed inset-0 z-50 bg-[oklch(16%_0_0_/_0.34)] transition-opacity duration-[var(--duration-fast)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
      />
      <DialogPrimitive.Popup
        data-slot="ds-dialog-popup"
        className={cn(
          "fixed top-1/2 left-1/2 z-50 grid max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-ds-16 overflow-y-auto rounded-[var(--radius-panel)] bg-[var(--card)] p-ds-24 font-sans text-foreground shadow-[var(--shadow-dialog)] transition-[opacity,transform,scale] duration-[var(--dialog-content-duration)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        <DialogPrimitive.Close
          data-slot="ds-dialog-close"
          aria-label="Fechar"
          className="absolute top-ds-16 right-ds-16 flex size-ds-32 items-center justify-center rounded-full border border-border bg-card text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/15 motion-reduce:transition-none"
        >
          <X size={16} aria-hidden="true" />
        </DialogPrimitive.Close>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DsDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-dialog-header"
      className={cn("flex flex-col gap-ds-4 pr-ds-32", className)}
      {...props}
    />
  );
}

function DsDialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="ds-dialog-title"
      className={cn("font-sans text-lg font-medium text-foreground", className)}
      {...props}
    />
  );
}

function DsDialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="ds-dialog-description"
      className={cn("font-sans text-sm text-[var(--text-secondary)] dark:text-muted-foreground", className)}
      {...props}
    />
  );
}

function DsDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-dialog-footer"
      className={cn("flex flex-col-reverse gap-ds-8 pt-ds-16 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export {
  DsDialog,
  DsDialogTrigger,
  DsDialogClose,
  DsDialogPopup,
  DsDialogHeader,
  DsDialogTitle,
  DsDialogDescription,
  DsDialogFooter,
};
