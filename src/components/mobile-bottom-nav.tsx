"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ChatCircleText,
  ClipboardText,
  MoreHorizontalIcon,
  Users,
} from "@/components/huge-icons";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const items = [
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Tarefas", href: "/tarefas", icon: ClipboardText },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-border bg-card/95 px-3 pt-2 pb-[max(0.625rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgb(15_23_42/0.08)] supports-backdrop-filter:backdrop-blur-xl max-[559px]:block dark:shadow-[0_-8px_24px_rgb(0_0_0/0.28)]"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-4 gap-1">
        {items.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active && "bg-accent text-accent-foreground hover:bg-accent/80 active:bg-accent/70",
              )}
            >
              <Icon aria-hidden="true" className="size-5" weight={active ? "fill" : "regular"} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-label="Abrir mais opções"
          onClick={() => setOpenMobile(true)}
          className="flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-md px-1.5 text-xs font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <MoreHorizontalIcon aria-hidden="true" className="size-5" />
          <span>Mais</span>
        </button>
      </div>
    </nav>
  );
}
