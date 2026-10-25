"use client";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { NotificationPopover } from "@/components/notification-popover";
import { AnimatedPageTitle } from "@/components/motion/animated-page-title";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import { Avatar } from "@/components/arc/avatar/avatar";
import { CircleHelp, HelpCircle, Search } from "lucide-react";
import { LightAppHeader } from "@/components/light/light-app-header";
import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { useDirectorRoute } from "@/components/light/use-director-route";
import { DirectorMoreSheet } from "@/components/light/director-more-sheet";
import { useDirectorChrome } from "@/components/light/director-chrome-context";
import { useState } from "react";

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
  if (useArcScopeEnabled()) {
    return <DirectorDashboardHeader
      breadcrumb={breadcrumb}
      title={title}
      rightSlot={rightSlot}
      showSidebarTrigger={showSidebarTrigger}
    />;
  }

  return (
    <header
      data-slot="dashboard-header"
      className="sticky top-0 z-30 flex h-(--header-height) min-w-0 shrink-0 items-center gap-3 border-b border-border/80 bg-background/92 px-5 backdrop-blur-md lg:px-6 max-[559px]:h-auto max-[559px]:min-h-[calc(var(--mobile-header-height)+var(--mobile-safe-top))] max-[559px]:flex-wrap max-[559px]:gap-x-2 max-[559px]:gap-y-1.5 max-[559px]:pb-2 max-[559px]:pt-(--mobile-safe-top) max-[559px]:pl-[max(var(--mobile-page-padding),var(--mobile-safe-left))] max-[559px]:pr-[max(var(--mobile-page-padding),var(--mobile-safe-right))]"
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
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-2.5 max-[559px]:contents">
        {rightSlot ? (
          <div aria-label="Ações da página" className="flex min-w-0 items-center gap-1.5 overflow-x-auto whitespace-nowrap pr-0.5 [scrollbar-width:none] max-[559px]:order-last max-[559px]:basis-full sm:max-w-[min(58vw,48rem)] sm:gap-2 lg:max-w-[min(62vw,58rem)]" data-slot="page-actions">
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

function DirectorDashboardHeader({
  breadcrumb,
  title,
  rightSlot,
  showSidebarTrigger,
}: Pick<DashboardHeaderProps, "breadcrumb" | "title" | "rightSlot" | "showSidebarTrigger">) {
  const route = useDirectorRoute();
  const chrome = useDirectorChrome();
  const [moreOpen, setMoreOpen] = useState(false);
  const root = route.parentHref === null;

  return (
    <div data-slot="dashboard-header" className="arc-venancor director-dashboard-header" data-skin="diretor">
      <LightAppHeader
        availability="available"
        availabilityPending={false}
        onToggleAvailability={() => undefined}
        onOpenMore={() => setMoreOpen(true)}
        hideAvailability
        routeOverride={{ title, isRoot: root, parentHref: route.parentHref, backToParent: true }}
        leading={root && showSidebarTrigger ? <SidebarTrigger aria-label="Abrir menu principal" className="size-11" /> : null}
        actions={(
          <>
            {rightSlot ? <div data-slot="page-actions" aria-label="Ações da página" className="director-page-actions">{rightSlot}</div> : null}
            <button type="button" aria-label="Buscar páginas, leads e clientes" title="Buscar (Ctrl+K)" className="director-header-action director-search-trigger" onClick={() => window.dispatchEvent(new Event("open-command-palette"))}>
              <Search aria-hidden="true" className="size-4" />
            </button>
            <NotificationPopover />
            <button type="button" aria-label="Reportar problema" title="Reportar problema" className="director-header-action director-feedback-trigger" onClick={() => window.dispatchEvent(new Event("open-system-feedback"))}>
              <CircleHelp aria-hidden="true" className="size-4" />
            </button>
            <button type="button" aria-label="Abrir perfil e mais opções" className="director-header-action director-profile-trigger" onClick={() => setMoreOpen(true)}>
              <Avatar name={chrome?.shellUser?.name || breadcrumb || title || "Diretor"} size="sm" aria-hidden="true" />
            </button>
          </>
        )}
        className="director-light-app-header"
      />
      <DirectorMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </div>
  );
}
