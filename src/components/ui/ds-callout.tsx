import * as React from "react";
import { cn } from "@/utils/core/cn";

export type DsCalloutTone = "neutral" | "info" | "success" | "warning" | "destructive";

export interface DsCalloutProps extends Omit<React.ComponentPropsWithoutRef<"div">, "title"> {
  tone?: DsCalloutTone;
  title: React.ReactNode;
  /** Tone-colored icon; decorative, so the meaning is always carried by the text. */
  icon?: React.ReactNode;
  /** Optional trailing action (a link or an outlined button). */
  action?: React.ReactNode;
}

const TONE_CONTAINER: Record<DsCalloutTone, string> = {
  neutral: "border-ds-ash bg-ds-paper-mist",
  info: "border-ds-electric-blue bg-ds-powder-blue",
  success: "border-ds-vivid-green bg-ds-soft-mint",
  warning: "border-ds-amber-ink bg-ds-amber-wash",
  destructive: "border-ds-rose-ink bg-ds-rose-wash",
};

const TONE_ICON: Record<DsCalloutTone, string> = {
  neutral: "text-ds-fog",
  info: "text-ds-electric-blue",
  success: "text-ds-vivid-green",
  warning: "text-ds-amber-ink",
  destructive: "text-ds-rose-ink",
};

/**
 * Callout / Alert panel — docs/design-system.md § Callout / Alert panel.
 * Reuses the Status Badge tone pairs at panel scale. 12px radius, 16px
 * padding, 1px tone-colored border (the one component where the border
 * carries semantic color). Body text stays Charcoal at 14px regardless of
 * tone — only the icon, border and wash carry the accent.
 */
export const DsCallout = React.forwardRef<HTMLDivElement, DsCalloutProps>(function DsCallout(
  { tone = "neutral", title, icon, action, className, children, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      role={tone === "destructive" || tone === "warning" ? "alert" : "status"}
      data-slot="ds-callout"
      className={cn(
        "flex items-start gap-ds-12 rounded-ds-cards border p-ds-16 font-ds-inter text-ds-body text-ds-charcoal",
        TONE_CONTAINER[tone],
        className,
      )}
      {...props}
    >
      {icon ? <span aria-hidden="true" className={cn("mt-0.5 flex size-4 shrink-0 items-center justify-center", TONE_ICON[tone])}>{icon}</span> : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="mt-ds-4 space-y-ds-4">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
});
