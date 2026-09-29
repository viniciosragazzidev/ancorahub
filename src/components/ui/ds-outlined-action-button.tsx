"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/core/cn";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";

export interface DsOutlinedActionButtonProps
  extends React.ComponentPropsWithoutRef<"button"> {
  loading?: boolean;
}

/**
 * Outlined Action Button — docs/design-system.md § Components.
 * White fill, 1px #e5e5e5 border. The workhorse for non-primary actions
 * (e.g. "Learn more", "View invoices").
 */
export const DsOutlinedActionButton = React.forwardRef<
  HTMLButtonElement,
  DsOutlinedActionButtonProps
>(function DsOutlinedActionButton(
  { className, children, loading = false, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-slot="ds-outlined-action-button"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(dsButtonVariants({ dsVariant: "outlined-action" }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
