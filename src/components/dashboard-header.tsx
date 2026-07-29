"use client";

import { BookOpen } from "@/components/huge-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationPopover } from "@/components/notification-popover";
import { AnimatedPageTitle } from "@/components/motion/animated-page-title";

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
      className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
      style={{ viewTransitionName: "ct-shell-header" }}
    >

      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} title={title} />
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
        {rightSlot ? (
          <div className="flex min-w-0 max-w-[calc(100vw-8rem)] items-center gap-1.5 overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:max-w-none sm:gap-2" data-slot="page-actions">
            {rightSlot}
          </div>
        ) : null}
        <div className="max-[559px]:hidden"><GlobalSearch /></div>
        <div className="max-[559px]:hidden"><ThemeToggle /></div>
        <Button aria-label="Abrir guia do sistema" title="Guia do sistema" render={<Link href="/guia" />} size="icon" variant="ghost" className={`size-9 rounded-lg transition-colors hover:bg-muted/60 ${rightSlot ? "max-[559px]:hidden" : ""}`}>
          <BookOpen aria-hidden="true" className="size-4" />
        </Button>
        <NotificationPopover />
      </div>
    </header>
  );
}
