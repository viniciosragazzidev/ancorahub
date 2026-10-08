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
  const { title, isRoot, parentHref } = useLightRoute();

  return (
    <header
      className={cn(
        "arc-venancor z-30 shrink-0 bg-(--background)/90 pt-(--mobile-safe-top) backdrop-blur-md",
        className,
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-4xl items-center gap-3 px-4 sm:px-6">
        {!isRoot && parentHref ? <LightBackButton fallbackHref={parentHref} /> : null}
        <p
          className={cn(
            "min-w-0 flex-1 truncate tracking-tight text-(--foreground)",
            isRoot ? "text-2xl font-bold" : "text-lg font-semibold",
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
