"use client";

import type { ReactNode } from "react";
import { Ellipsis } from "lucide-react";

import { cn } from "@/lib/utils";
import { LightAvailabilityPill, type LightAvailability } from "@/components/light-top-nav";

import { LightBackButton } from "./light-back-button";
import { useLightRoute } from "./use-light-route";

const roundButton =
  "grid size-11 shrink-0 place-items-center rounded-full bg-(--surface) text-(--foreground) shadow-(--shadow-resting) transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * Sticky app header (screens keep their own h1; this is the app bar label). First-level screens show the title and the availability
 * pill; internal screens show back + title + "Mais". Safe area on top.
 */
export function LightAppHeader({
  availability,
  availabilityPending,
  onToggleAvailability,
  onOpenMore,
  actions,
  className,
}: {
  availability: LightAvailability;
  availabilityPending: boolean;
  onToggleAvailability: () => void;
  onOpenMore: () => void;
  /** Extra buttons before "Mais" (44px round, white). */
  actions?: ReactNode;
  className?: string;
}) {
  const { title, isRoot, parentHref, backToParent } = useLightRoute();

  return (
    <header
      className={cn(
        "arc-venancor z-30 shrink-0 bg-(--surface)/92 pt-(--mobile-safe-top) backdrop-blur-md",
        className,
      )}
    >
      {/* Same header as the chat screens: full width, back at the left edge, 16/500 title. */}
      <div className="flex min-h-[60px] w-full items-center gap-2.5 px-3 py-2.5">
        {!isRoot && parentHref ? <LightBackButton fallbackHref={parentHref} alwaysParent={backToParent} className="size-10 border border-(--border)" /> : null}
        <p
          className={cn(
            "min-w-0 flex-1 truncate tracking-tight text-(--foreground)",
            isRoot ? "text-xl font-medium" : "text-base font-medium",
          )}
        >
          {title}
        </p>
        {actions}
        {isRoot ? (
          <LightAvailabilityPill
            availability={availability}
            isPending={availabilityPending}
            onToggle={onToggleAvailability}
          />
        ) : null}
        <button
          type="button"
          aria-label="Abrir menu Mais"
          aria-haspopup="dialog"
          onClick={onOpenMore}
          className={cn(roundButton, "md:hidden")}
        >
          <Ellipsis className="size-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
