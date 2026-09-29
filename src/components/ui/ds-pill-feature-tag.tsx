import * as React from "react";
import { cn } from "@/utils/core/cn";

export interface DsPillFeatureTagProps
  extends React.ComponentPropsWithoutRef<"span"> {
  /** Small colored glyph/emoji rendered before the label. */
  icon?: React.ReactNode;
  /**
   * Single accent color for the icon slot. The system allows exactly one
   * chromatic color per pill — never mix accents on the same tag.
   */
  accent?: "tangerine" | "vivid-green" | "lavender";
}

const ACCENT_CLASS: Record<NonNullable<DsPillFeatureTagProps["accent"]>, string> = {
  tangerine: "text-ds-tangerine",
  "vivid-green": "text-ds-vivid-green",
  lavender: "text-ds-lavender",
};

/**
 * Pill Feature Tag — docs/design-system.md § Components.
 * Transparent/white background, 9999px radius, no border. The system's
 * signature floating decorative element (e.g. "Affiliate Programs").
 */
export const DsPillFeatureTag = React.forwardRef<
  HTMLSpanElement,
  DsPillFeatureTagProps
>(function DsPillFeatureTag(
  { className, children, icon, accent = "tangerine", ...props },
  ref,
) {
  return (
    <span
      ref={ref}
      data-slot="ds-pill-feature-tag"
      className={cn(
        "inline-flex items-center gap-ds-8 rounded-ds-tags border-0 bg-transparent px-ds-16 py-ds-12 font-ds-inter text-ds-body font-medium text-ds-charcoal",
        className,
      )}
      {...props}
    >
      {icon ? (
        <span className={cn("inline-flex shrink-0 items-center", ACCENT_CLASS[accent])} aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {children}
    </span>
  );
});
