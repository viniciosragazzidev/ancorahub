"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ChatCircleText,
  House,
  ListChecks,
  MoreHorizontalIcon,
  Sparkle,
  Megaphone,
} from "@/components/huge-icons";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MobileBottomNavProps = {
  role?: string;
  jobTitle?: string | null;
};

export function MobileBottomNav({ role, jobTitle }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  const isMarketing = jobTitle === "marketing";
  const isBroker = role === "broker";
  const items = isMarketing
    ? [
        { label: "Campanhas", href: "/marketing/campanhas", icon: Megaphone },
        { label: "Leads", href: "/leads", icon: ListChecks },
        { label: "Qualificação", href: "/qualificacao", icon: Sparkle },
      ]
    : [
        { label: "Início", href: "/dashboard", icon: House },
        { label: isBroker ? "Minha fila" : "Leads", href: isBroker ? "/minha-fila" : "/leads", icon: ListChecks },
        { label: "Conversas", href: "/conversas", icon: ChatCircleText },
      ];

  return (
    <nav
      aria-label="Navegação principal"
      data-slot="mobile-bottom-nav"
      className="fixed inset-x-0 bottom-0 z-40 hidden border-t border-border bg-card/95 pl-[max(0.75rem,var(--mobile-safe-left))] pr-[max(0.75rem,var(--mobile-safe-right))] pt-1.5 pb-[max(0.5rem,var(--mobile-safe-bottom))] shadow-lg supports-backdrop-filter:backdrop-blur-xl max-[559px]:block"
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
                "flex min-h-(--mobile-touch-target) min-w-0 flex-col items-center justify-center gap-0.5 rounded-md px-1 text-[11px] font-medium text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active && "bg-accent text-accent-foreground hover:bg-accent/80 active:bg-accent/70",
              )}
            >
              <Icon aria-hidden="true" className="size-5" weight={active ? "fill" : "regular"} />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
        <Button
          type="button"
          aria-label="Abrir mais opções"
          onClick={() => setOpenMobile(true)}
          className="h-auto min-h-(--mobile-touch-target) min-w-0 flex-col gap-0.5 px-1 text-[11px] text-muted-foreground"
          variant="ghost"
        >
          <MoreHorizontalIcon aria-hidden="true" className="size-5" />
          <span>Mais</span>
        </Button>
      </div>
    </nav>
  );
}
