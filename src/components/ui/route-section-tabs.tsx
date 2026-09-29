import type { ComponentType } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type RouteSectionTab = {
  id: string;
  label: string;
  href: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

/** URL-backed section navigation shared by management pages. */
export function RouteSectionTabs({ label, tabs, active }: { label: string; tabs: readonly RouteSectionTab[]; active: string }) {
  return <nav aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border/70 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
    {tabs.map((tab) => {
      const current = tab.id === active;
      const Icon = tab.icon;
      return <Link
        key={tab.id}
        href={tab.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "relative inline-flex min-h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          current ? "text-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon aria-hidden={true} className="size-3.5" />
        {tab.label}
        {current ? <span aria-hidden="true" className="absolute -bottom-px left-3 right-3 h-0.5 rounded-full bg-primary" /> : null}
      </Link>;
    })}
  </nav>;
}
