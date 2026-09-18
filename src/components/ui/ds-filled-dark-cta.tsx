"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/utils/core/cn";
import { dsButtonVariants } from "@/components/ui/ds-button-variants";

export interface DsFilledDarkCtaProps
  extends React.ComponentPropsWithoutRef<"button"> {
  loading?: boolean;
}

/**
 * Filled Dark CTA — docs/design-system.md § Components.
 * Near-black fill, white text. The committed primary action: use once per
 * surface (e.g. "Sign up").
 */
export const DsFilledDarkCta = React.forwardRef<
  HTMLButtonElement,
  DsFilledDarkCtaProps
>(function DsFilledDarkCta(
  { className, children, loading = false, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      data-slot="ds-filled-dark-cta"
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(dsButtonVariants({ dsVariant: "filled-dark" }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});
