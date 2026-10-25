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
  hideAvailability = false,
  routeOverride,
  leading,
  moreButton,
  showMoreButton = true,
  titleAsHeading = false,
}: {
  /** Supervisor Lite: no availability (they do not receive leads). */
  hideAvailability?: boolean;
  availability: LightAvailability;
  availabilityPending: boolean;
  onToggleAvailability: () => void;
  onOpenMore: () => void;
  /** Extra buttons before "Mais" (44px round, white). */
  actions?: ReactNode;
  className?: string;
  /** Lets the director share this frame while keeping the existing Lite route table untouched. */
  routeOverride?: { title: string; isRoot: boolean; parentHref: string | null; backToParent?: boolean };
  leading?: ReactNode;
  moreButton?: ReactNode;
  showMoreButton?: boolean;
  /** Página com título global mantém um único h1 sem repetir outro no conteúdo. */
  titleAsHeading?: boolean;
}) {
  const lightRoute = useLightRoute();
  const title = routeOverride?.title ?? lightRoute.title;
  const isRoot = routeOverride?.isRoot ?? lightRoute.isRoot;
  const parentHref = routeOverride?.parentHref ?? lightRoute.parentHref;
  const backToParent = routeOverride?.backToParent ?? lightRoute.backToParent;
  const Title = titleAsHeading ? "h1" : "p";

  return (
    <header
      className={cn(
        "arc-venancor z-30 shrink-0 bg-(--surface)/92 pt-(--mobile-safe-top) backdrop-blur-md",
        className,
      )}
      data-skin={routeOverride ? "diretor" : undefined}
    >
      {/* Same header as the chat screens: full width, back at the left edge, 16/500 title. */}
      <div className="flex min-h-[60px] w-full items-center gap-2.5 px-3 py-2.5">
        {leading}
        {!isRoot && parentHref ? <LightBackButton fallbackHref={parentHref} alwaysParent={backToParent} className={routeOverride ? "size-11 border border-(--border)" : "size-10 border border-(--border)"} /> : null}
        <Title
          className={cn(
            "min-w-0 flex-1 truncate tracking-tight text-(--foreground)",
            isRoot ? "text-xl font-medium" : "text-base font-medium",
          )}
        >
          {title}
        </Title>
        {actions}
        {isRoot && !hideAvailability ? (
          <LightAvailabilityPill
            availability={availability}
            isPending={availabilityPending}
            onToggle={onToggleAvailability}
          />
        ) : null}
        {showMoreButton ? moreButton ?? (
          <button
            type="button"
            aria-label="Abrir menu Mais"
            aria-haspopup="dialog"
            onClick={onOpenMore}
            className={cn(roundButton, routeOverride ? "min-[1024px]:hidden" : "md:hidden")}
          >
            <Ellipsis className="size-5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
