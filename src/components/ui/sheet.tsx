"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "@/components/huge-icons";
import { ScrollArea } from "@/components/ui/scroll-area";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-foreground/24 supports-backdrop-filter:backdrop-blur-[2px] transition-[background-color,backdrop-filter,opacity] duration-[var(--dialog-overlay-duration)] ease-[var(--dialog-ease)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
        "fixed z-50 flex max-h-[calc(100dvh-1rem)] flex-col overflow-visible border border-border/80 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-[var(--shadow-dialog)] outline-none transition-[transform,opacity] duration-[var(--dialog-content-duration)] ease-[var(--dialog-ease)] data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none data-[side=bottom]:inset-x-2 data-[side=bottom]:bottom-2 data-[side=bottom]:h-auto data-[side=bottom]:rounded-2xl data-[side=bottom]:data-ending-style:translate-y-6 data-[side=bottom]:data-starting-style:translate-y-6 sm:data-[side=bottom]:inset-x-4 sm:data-[side=bottom]:bottom-4 sm:data-[side=bottom]:mx-auto sm:data-[side=bottom]:max-w-xl data-[side=left]:inset-y-2 data-[side=left]:left-2 data-[side=left]:h-[calc(100dvh-1rem)] data-[side=left]:w-[min(100vw-1rem,32rem)] data-[side=left]:rounded-2xl data-[side=left]:data-ending-style:translate-x-6 data-[side=left]:data-starting-style:translate-x-6 sm:data-[side=left]:inset-y-3 sm:data-[side=left]:left-3 sm:data-[side=left]:h-[calc(100dvh-1.5rem)] data-[side=right]:inset-y-2 data-[side=right]:right-2 data-[side=right]:h-[calc(100dvh-1rem)] data-[side=right]:w-[min(100vw-1rem,32rem)] data-[side=right]:rounded-2xl data-[side=right]:data-ending-style:translate-x-6 data-[side=right]:data-starting-style:translate-x-6 sm:data-[side=right]:inset-y-3 sm:data-[side=right]:right-3 sm:data-[side=right]:h-[calc(100dvh-1.5rem)] data-[side=top]:inset-x-2 data-[side=top]:top-2 data-[side=top]:h-auto data-[side=top]:rounded-2xl data-[side=top]:data-ending-style:translate-y-6 data-[side=top]:data-starting-style:translate-y-6 sm:data-[side=top]:inset-x-4 sm:data-[side=top]:top-4 sm:data-[side=top]:mx-auto sm:data-[side=top]:max-w-xl max-[559px]:data-[side=left]:inset-0 max-[559px]:data-[side=left]:h-dvh max-[559px]:data-[side=left]:max-h-dvh max-[559px]:data-[side=left]:w-full max-[559px]:data-[side=left]:rounded-none max-[559px]:data-[side=left]:data-starting-style:translate-x-0 max-[559px]:data-[side=left]:data-starting-style:translate-y-6 max-[559px]:data-[side=right]:inset-0 max-[559px]:data-[side=right]:h-dvh max-[559px]:data-[side=right]:max-h-dvh max-[559px]:data-[side=right]:w-full max-[559px]:data-[side=right]:rounded-none max-[559px]:data-[side=right]:data-starting-style:translate-x-0 max-[559px]:data-[side=right]:data-starting-style:translate-y-6",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                aria-label="Fechar painel"
                className="absolute top-[calc(1rem+var(--mobile-safe-top))] right-[max(1rem,var(--mobile-safe-right))] z-10 size-8 rounded-md border border-border bg-card text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground focus-visible:ring-2 sm:top-4 sm:right-4"
                size="icon"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Fechar painel</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(
        "flex shrink-0 flex-col gap-1.5 border-b border-border/80 bg-card/70 px-5 pt-[calc(1rem+var(--mobile-safe-top))] pr-14 pb-4 sm:px-6 sm:py-5",
        className,
      )}
      {...props}
    />
  );
}

function SheetBody({
  className,
  contentClassName,
  children,
  ...props
}: React.ComponentProps<typeof ScrollArea> & { contentClassName?: string }) {
  return (
    <ScrollArea
      data-slot="sheet-body"
      className={cn("min-h-0 flex-1 overscroll-contain", className)}
      {...props}
    >
      <div
        data-slot="sheet-body-content"
        className={cn("min-h-full px-5 py-5 sm:px-6 sm:py-6", contentClassName)}
      >
        {children}
      </div>
    </ScrollArea>
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "mt-auto flex shrink-0 flex-col gap-2 border-t border-border/80 bg-card/80 px-5 pt-3.5 pb-[max(0.875rem,var(--mobile-safe-bottom))] supports-backdrop-filter:bg-card/70 sm:flex-row sm:items-center sm:justify-end sm:px-6 sm:py-3.5",
        className,
      )}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-semibold tracking-tight text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("max-w-[44ch] text-sm leading-5 text-muted-foreground", className)}
      {...props}
    />
  );
}

function SheetSection({ className, ...props }: React.ComponentProps<"section">) {
  return (
    <section
      data-slot="sheet-section"
      className={cn("rounded-xl border border-border/80 bg-card/60", className)}
      {...props}
    />
  );
}

function SheetSectionHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-section-header"
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border/70 px-4 py-3.5",
        className,
      )}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetSection,
  SheetSectionHeader,
};
