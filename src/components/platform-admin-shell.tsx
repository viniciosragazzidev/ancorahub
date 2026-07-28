"use client";

import type { CSSProperties, ReactNode } from "react";
import { PlatformAdminSidebar } from "./platform-admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function PlatformAdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      className="overflow-hidden"
      style={
        {
          "--sidebar-width": "21.5rem",
          "--header-height": "3.75rem",
        } as CSSProperties
      }
    >
      <PlatformAdminSidebar />

      <SidebarInset className="min-w-0 min-h-0 h-dvh bg-background overflow-y-auto overscroll-contain">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
