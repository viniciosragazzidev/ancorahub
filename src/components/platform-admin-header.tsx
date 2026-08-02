"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationPopover } from "@/components/notification-popover";
import { AnimatedPageTitle } from "@/components/motion/animated-page-title";

export function PlatformAdminHeader({
  breadcrumb,
  title,
}: {
  breadcrumb: string;
  title: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:px-5 [&_[data-slot=button]]:text-sidebar-foreground [&_[data-slot=button]]:hover:bg-sidebar-accent [&_[data-slot=button]]:hover:text-sidebar-accent-foreground" style={{ viewTransitionName: "ct-shell-header" }}>
      <SidebarTrigger />
      <div className="h-4 w-px bg-sidebar-border" />
      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} compact title={title} tone="inverse" />
      </div>
      <NotificationPopover />
    </header>
  );
}
