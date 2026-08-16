"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationPopover } from "@/components/notification-popover";
import { AnimatedPageTitle } from "@/components/motion/animated-page-title";
import { SidebarTrigger } from "@/components/ui/sidebar";

import { HelpCircle } from "lucide-react";

type DashboardHeaderProps = {
  breadcrumb: string;
  title: string;
  rightSlot?: React.ReactNode;
};

export function DashboardHeader({
  breadcrumb,
  title,
  rightSlot,
}: DashboardHeaderProps) {
  return (
    <header
      className="sticky top-0 z-30 flex h-(--header-height) min-w-0 shrink-0 items-center gap-3 border-b border-border/80 bg-background/92 px-5 backdrop-blur-md lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
      style={{ viewTransitionName: "ct-shell-header" }}
    >
      <SidebarTrigger className="size-8 shrink-0" />
      <div className="h-4 w-px bg-border/50 shrink-0 max-[559px]:hidden" />
      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} title={title} />
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
        {rightSlot ? (
          <div aria-label="Ações da página" className="flex min-w-0 max-w-[calc(100vw-8rem)] items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-0.5 [scrollbar-width:none] sm:max-w-[min(58vw,48rem)] sm:gap-2 lg:max-w-[min(62vw,58rem)]" data-slot="page-actions">
            {rightSlot}
          </div>
        ) : null}
        <div className="max-[559px]:hidden"><GlobalSearch /></div>
        <div className="max-[559px]:hidden"><ThemeToggle /></div>
        <Button
          aria-label="Ajuda desta página"
          title="Ajuda desta página"
          onClick={() => window.dispatchEvent(new CustomEvent("open-contextual-help"))}
          size="icon"
          variant="ghost"
          className="size-8 rounded-lg transition-colors hover:bg-muted/60"
        >
          <HelpCircle className="size-4 text-muted-foreground" />
        </Button>
        <NotificationPopover />
      </div>
    </header>
  );
}
