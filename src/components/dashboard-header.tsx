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
      className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
      style={{ viewTransitionName: "ct-shell-header" }}
    >

      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} title={title} />
      </div>
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        {rightSlot}
        <div className="max-[559px]:hidden"><GlobalSearch /></div>
        <div className="max-[559px]:hidden"><ThemeToggle /></div>
        <Button aria-label="Abrir guia do sistema" title="Guia do sistema" render={<Link href="/guia" />} size="icon" variant="ghost" className="size-9 rounded-lg hover:bg-muted/60 transition-colors">
          <BookOpen aria-hidden="true" className="size-4" />
        </Button>
        <NotificationPopover />
      </div>
    </header>
  );
}
