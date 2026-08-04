"use client";

import type { CSSProperties, ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { CorreTopSidebar } from "@/components/corretop-sidebar";
import { CorreTopFinanceiroSidebar } from "@/components/corretop-financeiro-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

type Branding = {
  brandColor: string | null;
  logoUrl: string | null;
  tenantName: string | null;
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
}: {
  children: ReactNode;
  branding?: Branding;
}) {
  const pathname = usePathname();
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

  return (
    <SidebarProvider
      className="min-h-dvh overflow-hidden"
      style={
        {
          "--sidebar-width": "16rem",
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
        className="min-h-0 h-dvh bg-muted/25 overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable] dark:bg-background max-[559px]:pb-[calc(7rem+env(safe-area-inset-bottom))]"
        style={{
          scrollPaddingTop: "var(--header-height)",
          scrollPaddingBottom: "calc(7rem + env(safe-area-inset-bottom))",
        }}
      >
        <div data-slot="app-content" className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
