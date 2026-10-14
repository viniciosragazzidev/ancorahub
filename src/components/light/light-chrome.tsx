"use client";

import { CHAT_RAIL_REFRESH_EVENT } from "@/components/chat/chat-events";
import { TipHost } from "@/components/chat/tip-host";
import { Suspense, useEffect, useState, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { Bell, House, Settings, Users, UsersRound } from "lucide-react";

import "@/components/arc/venancor-scope.css";
import { useLightAvailability, type LightAvailability } from "@/components/light-top-nav";

import { ChatHome } from "@/components/chat/chat-home";
import type { ChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { REALTIME_SYNC_BROWSER_EVENT } from "@/components/providers/realtime-events";

import { A11yPrefsProvider } from "@/features/assist/a11y-prefs";
import { AssistHelpButton, AssistLayer } from "@/features/assist/components/assist-layer";
import { CelebrationHost } from "@/features/journey/components/celebration-host";
import type { ViewAsState } from "@/features/super-admin/components/view-as";
import { LiteMicroTour } from "@/components/chat/tour/lite-tour";

import { LightAppHeader } from "./light-app-header";
import { LightAvailabilityProvider } from "./light-availability-context";
import { useLightNavigationTracker } from "./light-navigation";
import { LightMoreSheet } from "./light-more-sheet";
import { useLightRoute } from "./use-light-route";
import { cn } from "@/lib/utils";

const MANAGER_NAV_ITEMS = [
  { href: "/dashboard", label: "Início", Icon: House },
  { href: "/leads", label: "Leads", Icon: Users },
  { href: "/equipe", label: "Equipe", Icon: UsersRound },
  { href: "/notificacoes", label: "Notificações", Icon: Bell },
  { href: "/settings", label: "Configurações", Icon: Settings },
] as const;

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
  journeyEnabled = false,
  welcomeVideoEnabled = false,
  teamRankingEnabled = false,
  viewAs = { canViewAs: false, viewingAs: null },
  audience = "broker",
  initialAvailability = "available",
}: {
  children: ReactNode;
  mainRef?: RefObject<HTMLElement | null>;
  branding?: { tenantName: string | null; logoUrl: string | null };
  user?: { name: string | null; email: string | null };
  showQuoteSimulator?: boolean;
  showDutyCalendar?: boolean;
  showRelationship?: boolean;
  journeyEnabled?: boolean;
  welcomeVideoEnabled?: boolean;
  teamRankingEnabled?: boolean;
  viewAs?: ViewAsState;
  audience?: "broker" | "supervisor" | "manager";
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
      journeyEnabled={journeyEnabled}
      viewAs={viewAs}
      teamRankingEnabled={teamRankingEnabled}
      audience={audience}
      availability={availability}
      availabilityPending={isPending}
      onChangeAvailability={setStatus}
    />
  );

  const chatRail = useDesktopChatRail(audience !== "manager");
  // Broker assistance ("Onde fica?" and the "?" of each screen) over the whole Lite.
  const withAssist = (content: ReactNode) => <A11yPrefsProvider>{audience === "broker"
    ? <AssistLayer pathname={pathname} capabilities={{ journey: journeyEnabled, quoteSimulator: showQuoteSimulator, dutyCalendar: showDutyCalendar, relationshipCenter: showRelationship }}>{content}</AssistLayer>
    : content}</A11yPrefsProvider>;
  const shell = { availability, isPending, setStatus, openMore: () => setMoreOpen(true), audience, welcomeVideo: welcomeVideoEnabled };
  // Computers: the conversation list stays on the left and the screen opens at the center
  // (CSS .lite-split, venancor-scope.css); phones keep one screen at a time.
  const withRail = (content: ReactNode) => withAssist(
    <LightAvailabilityProvider value={shell}>
      <div className={cn("lite-split", audience === "manager" && "lite-manager-split")}>
        {audience === "manager" ? (
          <nav className="lite-rail lite-manager-nav arc-venancor" aria-label="Navegação principal">
            <p className="px-3 pb-3 pt-2 text-xs font-semibold uppercase tracking-wide text-(--text-muted)">Gestão</p>
            <ul className="flex flex-col gap-1">
              {MANAGER_NAV_ITEMS.map(({ href, label, Icon }) => {
                const isActive = href === "/dashboard"
                  ? pathname === href
                  : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-(--duration-fast) motion-reduce:transition-none",
                        isActive ? "bg-(--foreground) text-(--surface)" : "text-(--text-secondary) hover:bg-(--surface) hover:text-(--foreground)",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      <span>{label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <aside className="lite-rail arc-venancor" aria-label="Conversas" aria-busy={!chatRail}>
            {chatRail ? (
              <ChatHome mode="rail" viewerName={chatRail.viewerName} assistants={chatRail.assistants} leads={chatRail.leads} nowIso={chatRail.nowIso} canQuote={chatRail.canQuote} />
            ) : (
              <div className="lite-rail-skeleton" aria-hidden="true">
                {Array.from({ length: 7 }, (_, index) => <span key={index} />)}
              </div>
            )}
          </aside>
        )}
        <div className="lite-main">{content}</div>
      </div>
      {/* Points, missions and achievements of the broker show up here, never over a lead offer. */}
      {journeyEnabled && audience === "broker" ? <CelebrationHost /> : null}
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
const RAIL_REFRESH_MS = 3000;

/**
 * The rail's list, loaded in the browser and only on computers (phones never
 * show it). Refreshed when realtime says something changed, at most every 3s.
 */
function useDesktopChatRail(enabled: boolean) {
  const [rail, setRail] = useState<ChatRailData | null>(null);
  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia(DESKTOP_QUERY);
    let alive = true;
    let timer = 0;
    let lastLoad = 0;
    const load = () => {
      if (!media.matches) return;
      lastLoad = Date.now();
      // A GET route, not a server action: "Ver como" refuses POSTs and the rail stayed a skeleton.
      void fetch("/api/chat/rail", { cache: "no-store" })
        .then((response) => (response.ok ? (response.json() as Promise<{ rail: ChatRailData | null }>) : null))
        .then((body) => { if (alive && body?.rail) setRail(body.rail); })
        .catch(() => undefined);
    };
    const onRealtime = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(load, Math.max(0, RAIL_REFRESH_MS - (Date.now() - lastLoad)));
    };
    load();
    media.addEventListener("change", load);
    window.addEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
    // Something was just seen (Âncora, Jornada): the blue dot leaves the list right away.
    window.addEventListener(CHAT_RAIL_REFRESH_EVENT, load);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      media.removeEventListener("change", load);
      window.removeEventListener(REALTIME_SYNC_BROWSER_EVENT, onRealtime);
      window.removeEventListener(CHAT_RAIL_REFRESH_EVENT, load);
    };
  }, [enabled]);
  return rail;
}
