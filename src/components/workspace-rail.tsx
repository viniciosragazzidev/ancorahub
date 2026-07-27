"use client";

import { CurrencyCircleDollar, SquaresFour } from "@/components/huge-icons";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { QuickActionsMenu } from "@/components/quick-actions-menu";

const areas = [
  { label: "Área administrativa", href: "/dashboard", icon: SquaresFour },
  { label: "Área financeira", href: "/financeiro", icon: CurrencyCircleDollar },
] as const;

export function WorkspaceRail() {
  const pathname = usePathname();
  const financialActive = pathname === "/financeiro" || pathname.startsWith("/financeiro/");

  return (
    <aside
      className="fixed inset-y-0 left-0 z-30 hidden w-(--workspace-rail-width) flex-col items-center border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground md:flex"
      aria-label="Áreas do sistema"
    >
      <div className="flex h-full flex-col items-center justify-between">
        <div className="flex flex-col items-center gap-3 pt-2">
          <WorkspaceRailButton area={areas[0]} active={!financialActive} />
          <div className="h-px w-5 bg-sidebar-border/40" />
          <WorkspaceRailButton area={areas[1]} active={financialActive} />
        </div>
        {!financialActive ? <QuickActionsMenu /> : null}
      </div>
    </aside>
  );
}

function WorkspaceRailButton({ area, active }: { area: (typeof areas)[number]; active: boolean }) {
  const Icon = area.icon;
  return (
    <Link
      href={area.href}
      aria-label={area.label}
      aria-current={active ? "page" : undefined}
      title={area.label}
      className={cn(
        "grid size-10 place-items-center rounded-xl border text-sidebar-foreground/60 transition-colors hover:bg-sidebar-warning hover:text-sidebar-warning-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        active && "border-primary/20 bg-primary/10 text-primary shadow-sm",
      )}
    >
      <Icon size={19} weight={active ? "duotone" : "regular"} />
    </Link>
  );
}
