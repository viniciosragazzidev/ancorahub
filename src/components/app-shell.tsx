"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { CorreTopSidebar } from "@/components/corretop-sidebar";
import { CorreTopFinanceiroSidebar } from "@/components/corretop-financeiro-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LightTopNavBar } from "@/components/light-top-nav";
import { OnboardingProvider } from "@/components/onboarding/onboarding-provider";
import { OnboardingWelcomeDialog } from "@/components/onboarding/onboarding-welcome-dialog";

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
  initialAvailability = "available",
  cleanUiEnabled = false,
}: {
  children: ReactNode;
  branding?: Branding;
  user?: UserInfo;
  isLightBroker?: boolean;
  initialAvailability?: "available" | "paused" | "offline";
  cleanUiEnabled?: boolean;
}) {
  const pathname = usePathname();
  const canvasRef = useRef<HTMLDivElement>(null);
  const isFinanceiro = pathname === "/financeiro" || pathname.startsWith("/financeiro/");
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
  }, [branding?.brandColor, readableBrandForeground]);

  // The authenticated shell owns vertical scrolling. Route changes must start at
  // its top, while query-only navigation (for example choosing a conversation)
  // keeps the current position intact.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      canvasRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  if (isLightBroker) {
    return (
      <SidebarProvider
        data-ui-refinement={cleanUiEnabled ? "clean" : "classic"}
        defaultOpen={false}
        open={false}
        className="min-h-dvh flex-col overflow-x-hidden"
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
        <div className="flex h-dvh w-full flex-col bg-background selection:bg-primary/20 overflow-hidden">
          <LightTopNavBar
            branding={branding}
            user={user}
            initialAvailability={initialAvailability}
          />
          <main ref={canvasRef} className="flex-1 min-h-0 w-full overflow-y-auto">
            {children}
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <OnboardingProvider>
      <SidebarProvider
        data-ui-refinement={cleanUiEnabled ? "clean" : "classic"}
        className="min-h-dvh overflow-hidden"
        style={
          {
            "--sidebar-width": isFinanceiro ? "16rem" : "5rem",
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
        {isFinanceiro ? (
          <CorreTopFinanceiroSidebar />
        ) : (
          <CorreTopSidebar logoUrl={branding?.logoUrl ?? null} />
        )}
        <SidebarInset
          ref={canvasRef}
          data-slot="app-scroll-frame"
          className="app-shell-canvas min-h-0 h-dvh overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]"
          style={{
            scrollPaddingTop: "var(--header-height)",
            scrollPaddingBottom: "var(--mobile-safe-bottom)",
          }}
        >
          <div data-slot="app-content" className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
        </SidebarInset>
        <OnboardingWelcomeDialog />
      </SidebarProvider>
    </OnboardingProvider>
  );
}
