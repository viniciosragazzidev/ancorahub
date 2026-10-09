"use client";

import { useState, type ReactNode, type RefObject } from "react";

import "@/components/arc/venancor-scope.css";
import { useLightAvailability, type LightAvailability } from "@/components/light-top-nav";

import { LightAppHeader } from "./light-app-header";
import { LightAvailabilityProvider } from "./light-availability-context";
import { useLightNavigationTracker } from "./light-navigation";
import { LightMoreSheet } from "./light-more-sheet";
import { useLightRoute } from "./use-light-route";

/**
 * Broker app shell: the chat screens draw everything themselves; the other
 * screens get only the app header (back + title) and the "Mais" sheet. No
 * side rail or bottom bar since the 2026-10-09 chat redesign: Início (the
 * conversations) is the navigation. The Arc tokens are scoped
 * to the chrome pieces (class arc-venancor), never to the screens inside, so
 * the existing Light screens keep their current look until their own phase.
 */
export function LightChrome({
  children,
  mainRef,
  user,
  showQuoteSimulator = false,
  showDutyCalendar = false,
  initialAvailability = "available",
}: {
  children: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
  branding?: { tenantName: string | null; logoUrl: string | null };
  user?: { name: string | null; email: string | null };
  showQuoteSimulator?: boolean;
  showDutyCalendar?: boolean;
  initialAvailability?: LightAvailability;
  queueBadgeCount?: number;
}) {
  const { pathname, chat } = useLightRoute();
  // The sheet belongs to the screen it was opened on: navigating closes it without an effect.
  const [moreSheet, setMoreSheet] = useState<{ open: boolean; path: string }>({ open: false, path: pathname });
  const moreOpen = moreSheet.open && moreSheet.path === pathname;
  const setMoreOpen = (open: boolean) => setMoreSheet({ open, path: pathname });
  const { availability, isPending, setStatus } = useLightAvailability(initialAvailability);
  useLightNavigationTracker();

  const sheet = (
    <LightMoreSheet
      open={moreOpen}
      onOpenChange={setMoreOpen}
      user={user}
      showQuoteSimulator={showQuoteSimulator}
      showDutyCalendar={showDutyCalendar}
      availability={availability}
      availabilityPending={isPending}
      onChangeAvailability={setStatus}
    />
  );

  // Chat screens draw their own header; the conversation list is the navigation.
  if (chat) {
    return (
      <div className="arc-venancor h-dvh w-full overflow-hidden bg-[var(--surface)]">
        <main ref={mainRef} data-slot="app-content" className="h-full w-full overflow-y-auto overscroll-contain">
          <LightAvailabilityProvider value={{ availability, isPending, setStatus, openMore: () => setMoreOpen(true) }}>{children}</LightAvailabilityProvider>
        </main>
        {sheet}
      </div>
    );
  }

  return (
    <div className="flex h-dvh w-full overflow-hidden light-canvas selection:bg-primary/20">
      <div className="flex min-w-0 flex-1 flex-col">
        <LightAppHeader
          availability={availability}
          availabilityPending={isPending}
          onToggleAvailability={() => setStatus(availability === "available" ? "paused" : "available")}
          onOpenMore={() => setMoreOpen(true)}
        />
        <main
          ref={mainRef}
          data-slot="app-content"
          className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pb-[var(--mobile-safe-bottom)]"
        >
          <LightAvailabilityProvider value={{ availability, isPending, setStatus, openMore: () => setMoreOpen(true) }}>{children}</LightAvailabilityProvider>
        </main>
      </div>
      {sheet}
    </div>
  );
}
