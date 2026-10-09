"use client";

import { useState, type ReactNode, type RefObject } from "react";

import "@/components/arc/venancor-scope.css";
import { useLightAvailability, type LightAvailability } from "@/components/light-top-nav";

import { LightAppHeader } from "./light-app-header";
import { LightAvailabilityProvider } from "./light-availability-context";
import { LightBottomNav } from "./light-bottom-nav";
import { useLightNavigationTracker } from "./light-navigation";
import { LightMoreSheet } from "./light-more-sheet";
import { LightSideRail } from "./light-side-rail";
import { useLightRoute } from "./use-light-route";

/**
 * Broker app shell: app header, floating bottom bar (mobile), side rail (md+)
 * and the "Mais" sheet around the scrolling content. The Arc tokens are scoped
 * to the chrome pieces (class arc-venancor), never to the screens inside, so
 * the existing Light screens keep their current look until their own phase.
 */
export function LightChrome({
  children,
  mainRef,
  branding,
  user,
  showQuoteSimulator = false,
  showDutyCalendar = false,
  initialAvailability = "available",
  queueBadgeCount = 0,
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
  const { pathname, tab, hidesTabBar } = useLightRoute();
  // The sheet belongs to the screen it was opened on: navigating closes it without an effect.
  const [moreSheet, setMoreSheet] = useState<{ open: boolean; path: string }>({ open: false, path: pathname });
  const moreOpen = moreSheet.open && moreSheet.path === pathname;
  const setMoreOpen = (open: boolean) => setMoreSheet({ open, path: pathname });
  const { availability, isPending, setStatus } = useLightAvailability(initialAvailability);
  useLightNavigationTracker();

  return (
    <div className="flex h-dvh w-full overflow-hidden light-canvas selection:bg-primary/20">
      <LightSideRail
        activeTab={tab}
        queueBadgeCount={queueBadgeCount}
        moreOpen={moreOpen}
        onOpenMore={() => setMoreOpen(true)}
        brand={branding}
        userName={user?.name ?? null}
      />
      <div className="flex min-w-0 flex-1 flex-col md:pl-[72px]">
        <LightAppHeader
          availability={availability}
          availabilityPending={isPending}
          onToggleAvailability={() => setStatus(availability === "available" ? "paused" : "available")}
          onOpenMore={() => setMoreOpen(true)}
        />
        <main
          ref={mainRef}
          data-slot="app-content"
          className={
            hidesTabBar
              ? "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain"
              : "min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pb-[calc(96px+var(--mobile-safe-bottom))] md:pb-0"
          }
        >
          <LightAvailabilityProvider value={{ availability, isPending, setStatus }}>{children}</LightAvailabilityProvider>
        </main>
      </div>
      {hidesTabBar ? null : (
        <LightBottomNav
          activeTab={tab}
          queueBadgeCount={queueBadgeCount}
          moreOpen={moreOpen}
          onOpenMore={() => setMoreOpen(true)}
        />
      )}
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
    </div>
  );
}
