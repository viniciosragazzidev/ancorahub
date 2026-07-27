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
    <header className="flex h-15 shrink-0 items-center gap-3 border-b border-border px-4 lg:px-6" style={{ viewTransitionName: "ct-shell-header" }}>
      <SidebarTrigger />
      <div className="h-4 w-px bg-border" />
      <div className="min-w-0 flex-1">
        <AnimatedPageTitle breadcrumb={breadcrumb} compact title={title} />
      </div>
      <NotificationPopover />
    </header>
  );
}
