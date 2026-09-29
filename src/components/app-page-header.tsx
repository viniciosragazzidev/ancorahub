"use client";

import { HelpCircle } from "lucide-react";

import { GlobalSearch } from "@/components/global-search";
import { NotificationPopover } from "@/components/notification-popover";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { DsPageHeader, type DsPageHeaderProps } from "@/components/ui/ds-page-header";

/**
 * Page header for pages inside the app shell that use the design-system look.
 *
 * The shell has no top bar of its own: each page's header provides the menu
 * button and the global controls. `DsPageHeader` alone is a pure design-system
 * block with none of that, so a page using it had NO way to open the menu on
 * mobile (and no search or notifications anywhere). This wrapper adds them:
 *
 * - the sidebar/menu button, always visible (it is the only way to navigate on mobile);
 * - notifications, always visible;
 * - search, theme and feedback on wider screens only, as in `DashboardHeader`.
 */
export type AppPageHeaderProps = Omit<DsPageHeaderProps, "leading" | "toolbar">;

export function AppPageHeader(props: AppPageHeaderProps) {
  return (
    <DsPageHeader
      {...props}
      leading={<SidebarTrigger aria-label="Abrir menu" className="size-9 shrink-0" />}
      toolbar={
        <>
          <div className="max-[559px]:hidden"><GlobalSearch /></div>
          <div className="max-[559px]:hidden"><ThemeToggle /></div>
          <button
            type="button"
            aria-label="Reportar problema"
            title="Reportar problema"
            onClick={() => window.dispatchEvent(new CustomEvent("open-system-feedback"))}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ds-electric-blue/40 max-[559px]:hidden"
          >
            <HelpCircle className="size-4" aria-hidden="true" />
          </button>
          <NotificationPopover />
        </>
      }
    />
  );
}
