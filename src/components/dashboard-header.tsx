"use client";

"use client";

import { BookOpen } from "@/components/huge-icons";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationPopover } from "@/components/notification-popover";
import { AnimatedPageTitle } from "@/components/motion/animated-page-title";
import { OnboardingHelpButton } from "@/components/onboarding/onboarding-help-button";

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
      className="sticky top-0 z-10 flex h-(--header-height) min-w-0 shrink-0 items-center gap-3 overflow-hidden border-b border-border/80 bg-card/95 px-5 shadow-[0_1px_0_rgb(15_23_42/0.02)] backdrop-blur-sm lg:px-6 max-[559px]:h-14 max-[559px]:gap-2 max-[559px]:px-3"
      style={{ viewTransitionName: "ct-shell-header" }}
    >

      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} title={title} />
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5">
        {rightSlot ? (
          <div aria-label="Ações da página" className="flex min-w-0 max-w-[calc(100vw-8rem)] items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-0.5 [scrollbar-width:none] [&_[data-slot=button]]:h-8 [&_[data-slot=button]]:rounded-lg [&_[data-slot=button]]:px-2.5 [&_[data-slot=button]]:text-xs [&_[data-slot=button]_svg]:size-3.5 sm:max-w-[min(58vw,48rem)] sm:gap-2 lg:max-w-[min(62vw,58rem)]" data-slot="page-actions">
            {rightSlot}
          </div>
        ) : null}
        <div className="max-[559px]:hidden"><GlobalSearch /></div>
        <div className="max-[559px]:hidden"><ThemeToggle /></div>
        <OnboardingHelpButton />
        <Button aria-label="Abrir guia do sistema" title="Guia do sistema" render={<Link href="/guia" />} size="icon" variant="ghost" className={`size-9 rounded-lg transition-colors hover:bg-muted/60 ${rightSlot ? "max-[559px]:hidden" : ""}`}>
          <BookOpen aria-hidden="true" className="size-4" />
        </Button>
        <NotificationPopover />
      </div>
    </header>
  );
}
