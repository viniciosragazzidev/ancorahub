"use client";

import { CHAT_RAIL_REFRESH_EVENT } from "@/components/chat/chat-events";
import { TipHost } from "@/components/chat/tip-host";
import Link from "next/link";
import { Suspense, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

import { Button } from "@/components/ui/button";

import "@/components/arc/venancor-scope.css";
import { useLightAvailability, type LightAvailability } from "@/components/light-top-nav";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatHome } from "@/components/chat/chat-home";
import type { ChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { REALTIME_SYNC_BROWSER_EVENT, type RealtimeSyncBrowserDetail } from "@/components/providers/realtime-events";
import { railLoadDelay, railRealtimeDecision } from "./chat-rail-refresh";

import { A11yPrefsProvider } from "@/features/assist/a11y-prefs";
import { AssistHelpButton, AssistLayer } from "@/features/assist/components/assist-layer";
import { CelebrationHost } from "@/features/journey/components/celebration-host";
import type { ViewAsState } from "@/features/super-admin/components/view-as";
import { LiteMicroTour } from "@/components/chat/tour/lite-tour";

import { LightAppHeader } from "./light-app-header";
import { LightAvailabilityProvider } from "./light-availability-context";
import { useLightNavigationTracker } from "./light-navigation";
import { LightMoreSheet } from "./light-more-sheet";
import { getLightMoreDestinations } from "./light-routes";
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
  showNegotiations = false,
  journeyEnabled = false,
  homeV2Enabled = false,
  welcomeVideoEnabled = false,
  brokerHomeRedesign = false,
  showHomeLearning = true,
  teamRankingEnabled = false,
  teamManagementEnabled = false,
  viewAs = { canViewAs: false, viewingAs: null },
  audience = "broker",
  initialChatRail = null,
  initialAvailability = "available",
  erpLinks = [],
}: {
  children: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
  branding?: { tenantName: string | null; logoUrl: string | null };
  user?: { name: string | null; email: string | null };
  showQuoteSimulator?: boolean;
  showDutyCalendar?: boolean;
  showRelationship?: boolean;
  showNegotiations?: boolean;
  journeyEnabled?: boolean;
  homeV2Enabled?: boolean;
  welcomeVideoEnabled?: boolean;
  brokerHomeRedesign?: boolean;
  showHomeLearning?: boolean;
  teamRankingEnabled?: boolean;
  teamManagementEnabled?: boolean;
  viewAs?: ViewAsState;
  audience?: "broker" | "supervisor" | "manager";
  initialChatRail?: ChatRailData | null;
  initialAvailability?: LightAvailability;
  queueBadgeCount?: number;
  erpLinks?: readonly { href: string; label: string }[];
}) {
  const { pathname, chat } = useLightRoute();
  const moreReturnTo = useRef<HTMLElement | null>(null);
  // The sheet belongs to the screen it was opened on: navigating closes it without an effect.
  const [moreSheet, setMoreSheet] = useState<{ open: boolean; path: string }>({ open: false, path: pathname });
  const moreOpen = moreSheet.open && moreSheet.path === pathname;
  const setMoreOpen = (open: boolean) => setMoreSheet({ open, path: pathname });
  const { availability, isPending, setStatus } = useLightAvailability(initialAvailability);
  useLightNavigationTracker();

  const sheet = (
    <LightMoreSheet
      erpLinks={erpLinks}
      open={moreOpen}
      onOpenChange={setMoreOpen}
      user={user}
      showQuoteSimulator={showQuoteSimulator}
      showDutyCalendar={showDutyCalendar}
      showRelationship={showRelationship}
      showNegotiations={showNegotiations}
      journeyEnabled={journeyEnabled}
      homeV2Enabled={homeV2Enabled}
      viewAs={viewAs}
      teamRankingEnabled={teamRankingEnabled}
      teamManagementEnabled={teamManagementEnabled}
      audience={audience}
      homeRedesign={audience === "broker" && brokerHomeRedesign}
      returnFocusRef={moreReturnTo}
      availability={availability}
      availabilityPending={isPending}
      onChangeAvailability={setStatus}
    />
  );

  const chatRail = useDesktopChatRail(true, initialChatRail, pathname);
  // Broker assistance ("Onde fica?" and the "?" of each screen) over the whole Lite.
  const withAssist = (content: ReactNode) => <A11yPrefsProvider>{audience === "broker"
    ? <AssistLayer pathname={pathname} capabilities={{ journey: journeyEnabled, quoteSimulator: showQuoteSimulator, dutyCalendar: showDutyCalendar, relationshipCenter: showRelationship }}>{content}</AssistLayer>
    : content}</A11yPrefsProvider>;
  const shell = {
    availability, isPending, setStatus, openMore: (opener?: HTMLElement) => { moreReturnTo.current = opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null); setMoreOpen(true); }, audience, welcomeVideo: welcomeVideoEnabled,
    homeRedesign: audience === "broker" && brokerHomeRedesign, showHomeLearning,
    homeTools: getLightMoreDestinations({ quoteSimulator: showQuoteSimulator, dutyCalendar: showDutyCalendar, relationshipCenter: showRelationship, journey: journeyEnabled }, audience),
  };
  // Computers: the conversation list stays on the left and the screen opens at the center
  // (CSS .lite-split, venancor-scope.css); phones keep one screen at a time.
  const withRail = (content: ReactNode) => withAssist(
    <LightAvailabilityProvider value={shell}>
      <div className="lite-split">
        <aside className="lite-rail arc-venancor" aria-label="Painel lateral" aria-busy={!chatRail}>
          {/* ScrollArea: the bar shows only while scrolling (Vinicios, 18/10: no fixed bar beside the list). */}
          <ScrollArea className="h-full" type="scroll">
          {audience === "manager" && teamManagementEnabled ? (
            <nav aria-label="Atalhos da unidade" className="border-b border-(--border) p-3">
              <Button
                render={<Link href="/gestao" aria-current={pathname === "/gestao" ? "page" : undefined} />}
                variant="secondary"
                size="lg"
                className="w-full justify-between rounded-2xl text-left"
              >
                <span>Gestão</span>
                <span aria-hidden="true">›</span>
              </Button>
            </nav>
          ) : null}
          {chatRail ? (
            <ChatHome mode="rail" viewerName={chatRail.viewerName} assistants={chatRail.assistants} leads={chatRail.leads} nowIso={chatRail.nowIso} canQuote={chatRail.canQuote} leadsBadgeCount={chatRail.leadsBadgeCount} />
          ) : (
            <div className="lite-rail-skeleton" aria-hidden="true">
              {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
            </div>
          )}
          </ScrollArea>
        </aside>
        <div className="lite-main">{content}</div>
      </div>
      {/* Points, missions and achievements of the broker show up here, never over a lead offer. */}
      {/* Never while viewing as someone: it would show and mark seen the broker's own celebrations. */}
      {journeyEnabled && audience === "broker" && !viewAs.viewingAs ? <CelebrationHost /> : null}
      {audience === "broker" ? <TipHost /> : null}
      {audience === "broker" ? <Suspense fallback={null}><LiteMicroTour pathname={pathname} /></Suspense> : null}
    </LightAvailabilityProvider>
  );

  // Chat screens draw their own header; the conversation list is the navigation.
  if (chat) {
    return withRail(
      <div className="arc-venancor h-app w-full overflow-hidden bg-[var(--surface)]">
        <main ref={mainRef} data-slot="app-content" className="h-full w-full overflow-y-auto overscroll-contain">
          <LightAvailabilityProvider value={shell}>{children}</LightAvailabilityProvider>
        </main>
        {sheet}
      </div>,
    );
  }

  return withRail(
    <div className="flex h-app w-full overflow-hidden light-canvas selection:bg-primary/20">
      <div className="flex min-w-0 flex-1 flex-col">
        <LightAppHeader
          availability={availability}
          availabilityPending={isPending}
          onToggleAvailability={() => setStatus(availability === "available" ? "paused" : "available")}
          hideAvailability={audience !== "broker"}
          actions={audience === "broker" ? <AssistHelpButton /> : undefined}
          onOpenMore={() => setMoreOpen(true)}
        />
        <main
          ref={mainRef}
          data-slot="app-content"
          className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain pb-[var(--mobile-safe-bottom)]"
        >
          <LightAvailabilityProvider value={shell}>{children}</LightAvailabilityProvider>
        </main>
      </div>
      {sheet}
    </div>,
  );
}

const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * The rail's list, loaded in the browser and only on computers (phones never
 * show it). Refreshed when realtime says something changed, at most every
 * RAIL_REFRESH_MS, never while the tab is hidden (the load waits for the tab to
 * come back), and not when the layout already brings it (manager Lite).
 */
function useDesktopChatRail(enabled: boolean, initialData: ChatRailData | null, pathname: string) {
  const [rail, setRail] = useState<ChatRailData | null>(initialData);
  const [previousInitialData, setPreviousInitialData] = useState(initialData);
  if (initialData !== previousInitialData) {
    setPreviousInitialData(initialData);
    setRail(initialData);
  }
  const serverRendersRail = initialData !== null;
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(DESKTOP_QUERY);
    let alive = true;
    let timer = 0;
    let lastLoad = 0;
    let pending = false;
    const load = () => {
      if (!media.matches) return;
      pending = false;
      lastLoad = Date.now();
      // A GET route, not a server action: "Ver como" refuses POSTs and the rail stayed a skeleton.
      void fetch("/api/chat/rail", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<{ rail: ChatRailData | null }>) : null))
        .then((body) => { if (alive && body) setRail(body.rail ?? null); })
        .catch(() => undefined);
    };
    const onRealtime = (event: Event) => {
      const decision = railRealtimeDecision({
        detail: (event as CustomEvent<RealtimeSyncBrowserDetail>).detail ?? null,
        pathname,
        serverRendersRail,
        visible: document.visibilityState === "visible",
      });
      if (decision === "skip") return;
      if (decision === "defer") { pending = true; return; }
      window.clearTimeout(timer);
      timer = window.setTimeout(load, railLoadDelay(lastLoad, Date.now()));
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible" || !pending) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(load, railLoadDelay(lastLoad, Date.now()));
    };
    if (!serverRendersRail) load();
    media.addEventListener("change", load);
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    document.addEventListener("visibilitychange", onVisibility);
    // Something was just seen (Âncora, Jornada): the blue dot leaves the list right away.
    window.addEventListener(CHAT_RAIL_REFRESH_EVENT, load);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      media.removeEventListener("change", load);
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(CHAT_RAIL_REFRESH_EVENT, load);
    };
  }, [enabled, serverRendersRail, pathname]);
  return rail;
}
