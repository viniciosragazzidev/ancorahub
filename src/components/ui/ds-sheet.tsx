"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/utils/core/cn";

/**
 * Sheet / Drawer — docs/design-system.md § Sheet / Drawer.
 * A side panel for a focused secondary task (edit a queue, a duty, a rule)
 * without leaving the list the user came from. Radius 16px only on the two
 * corners on the inner edge; the edge flush with the viewport stays square.
 * 1px Ash border on the edge facing the page, --shadow-lg (overlay surface,
 * same as Dialog). Header/body/footer follow Dialog.
 *
 * Re-skins @base-ui/react/dialog (focus trap, Esc, scroll lock, portal).
 * Below 560px the sheet covers the viewport (a 32rem panel would not fit).
 */
const DsSheet = SheetPrimitive.Root;
const DsSheetTrigger = SheetPrimitive.Trigger;
const DsSheetClose = SheetPrimitive.Close;

type DsSheetSide = "right" | "left";

function DsSheetContent({
  className,
  children,
  side = "right",
  ...props
}: SheetPrimitive.Popup.Props & { side?: DsSheetSide }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Backdrop
        data-slot="ds-sheet-overlay"
        className="fixed inset-0 z-50 bg-ds-midnight-ink/40 transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0 motion-reduce:transition-none"
      />
      <SheetPrimitive.Popup
        data-slot="ds-sheet-content"
        data-side={side}
        className={cn(
          "fixed inset-y-0 z-50 flex h-dvh w-full flex-col border-ds-ash bg-ds-canvas-white font-ds-inter text-ds-charcoal shadow-ds-lg outline-none transition-[transform,opacity] duration-200 ease-out motion-reduce:transition-none sm:w-[min(100vw,34rem)]",
          side === "right"
            ? "right-0 border-l sm:rounded-l-ds-large-cards data-ending-style:translate-x-6 data-starting-style:translate-x-6 data-ending-style:opacity-0 data-starting-style:opacity-0"
            : "left-0 border-r sm:rounded-r-ds-large-cards data-ending-style:-translate-x-6 data-starting-style:-translate-x-6 data-ending-style:opacity-0 data-starting-style:opacity-0",
          className,
        )}
        {...props}
      >
        {children}
        <SheetPrimitive.Close
          data-slot="ds-sheet-close"
          aria-label="Fechar"
          className="absolute top-ds-16 right-ds-16 flex size-ds-32 items-center justify-center rounded-ds-buttons text-ds-graphite outline-none transition-colors hover:bg-ds-paper-mist focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40"
        >
          <X size={16} aria-hidden="true" />
        </SheetPrimitive.Close>
      </SheetPrimitive.Popup>
    </SheetPrimitive.Portal>
  );
}

function DsSheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-sheet-header"
      className={cn("flex flex-col gap-ds-4 border-b border-ds-ash px-ds-24 py-ds-20 pr-ds-56", className)}
      {...props}
    />
  );
}

function DsSheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="ds-sheet-title"
      className={cn("font-ds-inter text-ds-heading-sm font-semibold text-ds-charcoal", className)}
      {...props}
    />
  );
}

function DsSheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="ds-sheet-description"
      className={cn("font-ds-inter text-ds-body text-ds-steel", className)}
      {...props}
    />
  );
}

/** Scrollable body; the header and footer stay pinned. */
function DsSheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-sheet-body"
      className={cn("min-h-0 flex-1 space-y-ds-24 overflow-y-auto px-ds-24 py-ds-20", className)}
      {...props}
    />
  );
}

/** Groups fields under a short title, like "Destino" or "Elegibilidade". */
function DsSheetSection({ title, description, className, children, ...props }: Omit<React.ComponentProps<"section">, "title"> & { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <section data-slot="ds-sheet-section" className={cn("space-y-ds-12", className)} {...props}>
      <div>
        <h3 className="font-ds-inter text-ds-body font-semibold text-ds-charcoal">{title}</h3>
        {description ? <p className="mt-ds-4 font-ds-inter text-ds-caption text-ds-fog">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function DsSheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="ds-sheet-footer"
      className={cn("flex flex-col-reverse gap-ds-8 border-t border-ds-ash px-ds-24 py-ds-16 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export {
  DsSheet,
  DsSheetTrigger,
  DsSheetClose,
  DsSheetContent,
  DsSheetHeader,
  DsSheetTitle,
  DsSheetDescription,
  DsSheetBody,
  DsSheetSection,
  DsSheetFooter,
};
