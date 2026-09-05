"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationPopover } from "@/components/notification-popover";
import { AnimatedPageTitle } from "@/components/motion/animated-page-title";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import { HelpCircle } from "lucide-react";

type DashboardHeaderProps = {
  breadcrumb: string;
  title: string;
  rightSlot?: React.ReactNode;
  showModeToggle?: boolean;
  showSidebarTrigger?: boolean;
};

export function DashboardHeader({
  breadcrumb,
  title,
  rightSlot,
  showModeToggle = false,
  showSidebarTrigger = true,
}: DashboardHeaderProps) {
  return (
    <header
      data-slot="dashboard-header"
      className="sticky top-0 z-30 flex h-(--header-height) min-w-0 shrink-0 items-center gap-3 border-b border-border/80 bg-background/92 px-5 backdrop-blur-md lg:px-6 max-[559px]:h-[calc(var(--mobile-header-height)+var(--mobile-safe-top))] max-[559px]:gap-2 max-[559px]:pt-(--mobile-safe-top) max-[559px]:pl-[max(var(--mobile-page-padding),var(--mobile-safe-left))] max-[559px]:pr-[max(var(--mobile-page-padding),var(--mobile-safe-right))]"
      style={{ viewTransitionName: "ct-shell-header" }}
    >
      {showSidebarTrigger ? (
        <>
          <SidebarTrigger className="size-8 shrink-0" />
          <div className="h-4 w-px bg-border/50 shrink-0 max-[559px]:hidden" />
        </>
      ) : null}
      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} title={title} />
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
        {rightSlot ? (
          <div aria-label="Ações da página" className="flex min-w-0 max-w-[calc(100vw-8rem)] items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-0.5 [scrollbar-width:none] sm:max-w-[min(58vw,48rem)] sm:gap-2 lg:max-w-[min(62vw,58rem)]" data-slot="page-actions">
            {rightSlot}
          </div>
        ) : null}
        {showModeToggle ? <div className="max-[559px]:hidden"><ExperienceModeToggle variant="pill" /></div> : null}
        <div className="max-[559px]:hidden"><GlobalSearch /></div>
        <div className="max-[559px]:hidden"><ThemeToggle /></div>
        <Button
          aria-label="Reportar problema"
          title="Reportar problema"
          onClick={() => window.dispatchEvent(new CustomEvent("open-system-feedback"))}
          size="icon"
          variant="ghost"
          className="size-8 rounded-lg transition-colors hover:bg-muted/60 max-[559px]:hidden"
        >
          <HelpCircle className="size-4 text-muted-foreground" />
        </Button>
        <NotificationPopover />
      </div>
    </header>
  );
}
