"use client";

import { useEffect, useState, type ReactNode, type RefObject } from "react";

import "@/components/arc/venancor-scope.css";
import { useLightAvailability, type LightAvailability } from "@/components/light-top-nav";

import { ChatHome } from "@/components/chat/chat-home";
import type { ChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { loadChatRailAction } from "@/features/broker-workspace/chat/chat-rail-actions";
import { REALTIME_SYNC_BROWSER_EVENT } from "@/components/providers/realtime-events";

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
  showRelationship = false,
  initialAvailability = "available",
}: {
  children: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
  branding?: { tenantName: string | null; logoUrl: string | null };
  user?: { name: string | null; email: string | null };
  showQuoteSimulator?: boolean;
  showDutyCalendar?: boolean;
  showRelationship?: boolean;
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
      showRelationship={showRelationship}
      availability={availability}
      availabilityPending={isPending}
      onChangeAvailability={setStatus}
    />
  );

  const chatRail = useDesktopChatRail();
  const shell = { availability, isPending, setStatus, openMore: () => setMoreOpen(true) };
  // Computers: the conversation list stays on the left and the screen opens at the center
  // (CSS .lite-split, venancor-scope.css); phones keep one screen at a time.
  const withRail = (content: ReactNode) => (
    <LightAvailabilityProvider value={shell}>
      <div className="lite-split">
        <aside className="lite-rail arc-venancor" aria-label="Conversas" aria-busy={!chatRail}>
          {chatRail ? (
            <ChatHome mode="rail" viewerName={chatRail.viewerName} assistants={chatRail.assistants} leads={chatRail.leads} nowIso={chatRail.nowIso} canQuote={chatRail.canQuote} />
          ) : (
            <div className="lite-rail-skeleton" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
            </div>
          )}
        </aside>
        <div className="lite-main">{content}</div>
      </div>
    </LightAvailabilityProvider>
  );

  // Chat screens draw their own header; the conversation list is the navigation.
  if (chat) {
    return withRail(
      <div className="arc-venancor h-dvh w-full overflow-hidden bg-[var(--surface)]">
        <main ref={mainRef} data-slot="app-content" className="h-full w-full overflow-y-auto overscroll-contain">
          <LightAvailabilityProvider value={{ availability, isPending, setStatus, openMore: () => setMoreOpen(true) }}>{children}</LightAvailabilityProvider>
        </main>
        {sheet}
      </div>,
    );
  }

  return withRail(
    <div className={`flex h-dvh w-full overflow-hidden light-canvas selection:bg-primary/20 ${WHITE_CANVAS.includes(pathname) ? "light-canvas-white" : ""}`}>
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
    </div>,
  );
}

/** Screens drawn as one white sheet (list-like), instead of cards on the gray canvas. */
const WHITE_CANVAS = ["/notificacoes", "/plantoes/agora"];

const DESKTOP_QUERY = "(min-width: 1024px)";
const RAIL_REFRESH_MS = 3000;

/**
 * The rail's list, loaded in the browser and only on computers (phones never
 * show it). Refreshed when realtime says something changed, at most every 3s.
 */
function useDesktopChatRail() {
  const [rail, setRail] = useState<ChatRailData | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(DESKTOP_QUERY);
    let alive = true;
    let timer = 0;
    let lastLoad = 0;
    const load = () => {
      if (!media.matches) return;
      lastLoad = Date.now();
      void loadChatRailAction().then((data) => { if (alive && data) setRail(data); }).catch(() => undefined);
    };
    const onRealtime = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, Math.max(0, RAIL_REFRESH_MS - (Date.now() - lastLoad)));
    };
    load();
    media.addEventListener("change", load);
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      media.removeEventListener("change", load);
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    };
  }, []);
  return rail;
}
