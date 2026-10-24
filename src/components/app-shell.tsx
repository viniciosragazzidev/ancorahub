"use client";

import type { CSSProperties, ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useInterfaceMotionEnabled } from "@/components/motion/interface-motion-provider";
import { CorreTopSidebar } from "@/components/corretop-sidebar";
import { CorreTopFinanceiroSidebar } from "@/components/corretop-financeiro-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ChatRailData } from "@/features/broker-workspace/chat/chat-rail-data";
import { ViewAsBanner, type ViewAsState } from "@/features/super-admin/components/view-as";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { LightChrome } from "@/components/light/light-chrome";
import { OnboardingWelcomeDialog } from "@/components/onboarding/onboarding-welcome-dialog";
import { ArcScopeProvider, DIRECTOR_LITE_PORTAL_ROOT_ID } from "@/components/arc/arc-scope-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { isDirectorLiteRouteOptedOut } from "@/components/arc/director-lite-routes";
// Already in the shell bundle before the director skin (LightChrome imports venancor-scope.css);
// every rule of director-skin.css sits under [data-skin="diretor"], so with the key off nothing changes.
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";

// Client only: it reads the broker's WhatsApp session (server actions) and stays hidden until it knows.
const WhatsAppMissingBanner = dynamic(() => import("@/components/whatsapp/whatsapp-missing-banner").then((mod) => mod.WhatsAppMissingBanner), { ssr: false });

type Branding = {
  brandColor: string | null;
  logoUrl: string | null;
  tenantName: string | null;
};

type UserInfo = {
  name: string | null;
  email: string | null;
  role?: string;
  jobTitle?: string | null;
};

function getReadableForeground(hex: string) {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const luminance = channels.reduce((total, channel, index) => {
    const adjusted = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return total + adjusted * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  return luminance > 0.45 ? "#18181b" : "#ffffff";
}

export function AppShell({
  children,
  branding,
  user,
  isLightBroker = false,
  showDutyCalendar = false,
  showRelationship = false,
  journeyEnabled = false,
  welcomeVideoEnabled = false,
  teamRankingEnabled = false,
  teamManagementEnabled = false,
  viewAs = { canViewAs: false, viewingAs: null },
  liteAudience = "broker",
  initialChatRail = null,
  showQuoteSimulator = false,
  initialAvailability = "available",
  cleanUiEnabled = false,
  queueBadgeCount = 0,
  directorLiteEnabled = false,
}: {
  children: ReactNode;
  branding?: Branding;
  user?: UserInfo;
  isLightBroker?: boolean;
  showDutyCalendar?: boolean;
  showRelationship?: boolean;
  journeyEnabled?: boolean;
  /** Welcome video on the broker's first access (Super-admin flag). */
  welcomeVideoEnabled?: boolean;
  teamRankingEnabled?: boolean;
  teamManagementEnabled?: boolean;
  /** Super admin "Ver como" (button and the strip while viewing as someone). */
  viewAs?: ViewAsState;
  /** Who uses the Lite chrome (supervisor Lite, 2026-10-10). */
  liteAudience?: "broker" | "supervisor" | "manager";
  initialChatRail?: ChatRailData | null;
  showQuoteSimulator?: boolean;
  initialAvailability?: "available" | "paused" | "offline";
  cleanUiEnabled?: boolean;
  /** Leads waiting for the broker to accept; shown as the badge on the Fila tab (Light only). */
  queueBadgeCount?: number;
  directorLiteEnabled?: boolean;
}) {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLDivElement>(null);
  const isFinanceiro = pathname === "/financeiro" || pathname.startsWith("/financeiro/");
  const directorLiteRouteOptedOut = isDirectorLiteRouteOptedOut(pathname);
  const readableBrandForeground = branding?.brandColor
    ? getReadableForeground(branding.brandColor)
    : null;

  useEffect(() => {
    const root = document.documentElement;
    const variables = {
      "--primary": branding?.brandColor ?? "",
      "--primary-foreground": readableBrandForeground ?? "",
      "--ring": branding?.brandColor ?? "",
      "--sidebar-primary": branding?.brandColor ?? "",
      "--sidebar-primary-foreground": readableBrandForeground ?? "",
      "--sidebar-ring": branding?.brandColor ?? "",
      "--director-brand-color": directorLiteEnabled ? branding?.brandColor ?? "#3b2dff" : "",
      "--director-brand-foreground": directorLiteEnabled ? readableBrandForeground ?? "#ffffff" : "",
    } as const;
    const previous = Object.fromEntries(
      Object.keys(variables).map((name) => [name, root.style.getPropertyValue(name)]),
    );

    for (const [name, value] of Object.entries(variables)) {
      if (value) root.style.setProperty(name, value);
    }

    return () => {
      for (const name of Object.keys(variables)) {
        const previousValue = previous[name];
        if (previousValue) root.style.setProperty(name, previousValue);
        else root.style.removeProperty(name);
      }
    };
  }, [branding?.brandColor, directorLiteEnabled, readableBrandForeground]);

  // The authenticated shell owns vertical scrolling. Route changes must start at
  // its top, while query-only navigation (for example choosing a conversation)
  // keeps the current position intact.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      canvasRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  // Crossfade leve (150ms, só opacity) do conteúdo principal ao trocar de rota; header e sidebar ficam fixos.
  const motionEnabled = useInterfaceMotionEnabled();
  const firstPathname = useRef(pathname);
  useEffect(() => {
    if (!motionEnabled || firstPathname.current === pathname) return;
    firstPathname.current = pathname;
    const content = document.querySelector<HTMLElement>("[data-slot=\"app-content\"]");
    if (!content) return;
    for (const child of Array.from(content.children)) {
      if (child.tagName === "HEADER" || typeof child.animate !== "function") continue;
      child.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 150, easing: "cubic-bezier(0.25, 1, 0.5, 1)" });
    }
  }, [pathname, motionEnabled]);

  if (isLightBroker) {
    return (
      <SidebarProvider
        data-ui-refinement={cleanUiEnabled ? "clean" : "classic"}
        defaultOpen={false}
        open={false}
        className="min-h-app flex-col overflow-x-hidden"
        style={
          {
            "--sidebar-width": "0px",
            "--header-height": "3.5rem",
            ...(branding?.brandColor
              ? {
                  "--primary": branding.brandColor,
                  "--primary-foreground": readableBrandForeground,
                  "--ring": branding.brandColor,
                  "--sidebar-primary": branding.brandColor,
                  "--sidebar-primary-foreground": readableBrandForeground,
                  "--sidebar-ring": branding.brandColor,
                }
              : {}),
          } as CSSProperties
        }
      >
        <ViewAsBanner viewingAs={viewAs.viewingAs} />
        {liteAudience === "broker" && !viewAs.viewingAs ? <WhatsAppMissingBanner /> : null}
        <LightChrome
          viewAs={viewAs}
          mainRef={canvasRef}
          branding={branding}
          user={user}
          showDutyCalendar={showDutyCalendar}
          showRelationship={showRelationship}
          journeyEnabled={journeyEnabled}
          welcomeVideoEnabled={welcomeVideoEnabled}
          teamRankingEnabled={teamRankingEnabled}
          teamManagementEnabled={teamManagementEnabled}
          audience={liteAudience}
          initialChatRail={initialChatRail}
          showQuoteSimulator={showQuoteSimulator}
          initialAvailability={initialAvailability}
          queueBadgeCount={queueBadgeCount}
        >
          {children}
        </LightChrome>
      </SidebarProvider>
    );
  }

  const directorSkinStyle = directorLiteEnabled
    ? {
        "--director-brand-color": branding?.brandColor ?? "#3b2dff",
        "--director-brand-foreground": readableBrandForeground ?? "#ffffff",
      } as CSSProperties
    : undefined;

  return (
    <ArcScopeProvider enabled={directorLiteEnabled}>
    <TooltipProvider delay={directorLiteEnabled ? 400 : 300} timeout={directorLiteEnabled ? 600 : 400}>
    <OnboardingProvider>
      <SidebarProvider
        data-ui-refinement={cleanUiEnabled ? "clean" : "classic"}
        className={cn("min-h-app overflow-hidden", viewAs.viewingAs && "flex-wrap content-start")}
        style={
          {
            "--sidebar-width": isFinanceiro ? "16rem" : "17rem",
            "--sidebar-width-icon": isFinanceiro ? "3.5rem" : "4.5rem",
            "--header-height": "4rem",
            ...(branding?.brandColor
              ? {
                  "--primary": branding.brandColor,
                  "--primary-foreground": readableBrandForeground,
                  "--ring": branding.brandColor,
                  "--sidebar-primary": branding.brandColor,
                  "--sidebar-primary-foreground": readableBrandForeground,
                  "--sidebar-ring": branding.brandColor,
                }
              : {}),
          } as CSSProperties
        }
      >
        <ViewAsBanner viewingAs={viewAs.viewingAs} />
        {isFinanceiro ? (
          <CorreTopFinanceiroSidebar />
        ) : directorLiteEnabled ? (
          <div className="arc-venancor" data-skin="diretor" style={{ ...directorSkinStyle, display: "contents" }}>
            <CorreTopSidebar logoUrl={branding?.logoUrl ?? null} />
          </div>
        ) : (
          <CorreTopSidebar logoUrl={branding?.logoUrl ?? null} />
        )}
        {directorLiteEnabled ? <div id={DIRECTOR_LITE_PORTAL_ROOT_ID} className="arc-venancor" data-skin="diretor" style={{ ...directorSkinStyle, display: "contents" }} /> : null}
        <SidebarInset
          ref={canvasRef}
          data-slot="app-scroll-frame"
          data-skin={directorLiteEnabled ? directorLiteRouteOptedOut ? "off" : "diretor" : undefined}
          className={cn("app-shell-canvas min-h-0 h-app overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]", directorLiteEnabled && !directorLiteRouteOptedOut && "arc-venancor")}
          style={{
            scrollPaddingTop: "var(--header-height)",
            scrollPaddingBottom: "var(--mobile-safe-bottom)",
            ...(directorLiteEnabled && !directorLiteRouteOptedOut ? directorSkinStyle : {}),
          }}
        >
          <div data-slot="app-content" className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
        <OnboardingWelcomeDialog />
      </SidebarProvider>
    </OnboardingProvider>
    </TooltipProvider>
    </ArcScopeProvider>
  );
}
