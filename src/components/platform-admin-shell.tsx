"use client";

import type { CSSProperties, ReactNode } from "react";
import { PlatformAdminSidebar } from "./platform-admin-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function PlatformAdminShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      className="min-h-dvh overflow-hidden"
      style={
        {
          "--sidebar-width": "225px",
          "--header-height": "3.75rem",
        } as CSSProperties
      }
    >
      <PlatformAdminSidebar />

      <SidebarInset className="min-h-0 h-dvh bg-background overflow-y-auto overflow-x-hidden overscroll-contain [scrollbar-gutter:stable]">
        <div data-slot="app-content" className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
