"use client";

import type { CSSProperties, ReactNode } from "react";
import { SuperDevSidebar } from "@/components/super-dev-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { SquaresFour, ShieldStar } from "@/components/huge-icons";
import Link from "next/link";

const railAreas = [
  { label: "Área do Sistema", href: "/dashboard", icon: SquaresFour },
  { label: "Área de Administração", href: "/super-dev", icon: ShieldStar },
] as const;

export function SuperDevShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider
      className="overflow-hidden"
      style={
        {
          "--sidebar-width": "21.5rem",
          "--workspace-rail-width": "4rem",
          "--header-height": "3.75rem",
        } as CSSProperties
      }
    >
      {/* Workspace Rail exactly matching the main app shell style */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-(--workspace-rail-width) flex-col items-center border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground md:flex"
        aria-label="Áreas de administração"
      >
        <div className="flex h-full flex-col items-center justify-between">
          <div className="flex flex-col items-center gap-3 pt-2">
            <Link
              href={railAreas[0].href}
              aria-label={railAreas[0].label}
              title={railAreas[0].label}
              className="grid size-10 place-items-center rounded-xl border border-transparent text-sidebar-foreground/60 transition-colors hover:bg-sidebar-warning hover:text-sidebar-warning-foreground"
            >
              <SquaresFour size={19} />
            </Link>
            <div className="h-px w-5 bg-sidebar-border/40" />
            <Link
              href={railAreas[1].href}
              aria-label={railAreas[1].label}
              aria-current="page"
              title={railAreas[1].label}
              className="grid size-10 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-sm"
            >
              <ShieldStar size={19} weight="duotone" />
            </Link>
          </div>
        </div>
      </aside>

      <SuperDevSidebar />

      <SidebarInset className="min-w-0 min-h-0 h-dvh bg-background overflow-y-auto overscroll-contain">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
