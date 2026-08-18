"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, ListChecks, Users } from "@/components/huge-icons";
import { cn } from "@/lib/utils";

const LIGHT_NAV_ITEMS = [
  { label: "Resumo", href: "/dashboard", icon: House },
  { label: "Leads", href: "/minha-fila", icon: ListChecks },
  { label: "Clientes", href: "/clientes", icon: Users },
] as const;

export function LightBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação Light do Corretor"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-card/95 px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgb(0_0_0/0.12)] backdrop-blur-xl"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-3 gap-2">
        {LIGHT_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (href === "/minha-fila" && pathname.startsWith("/leads")) ||
            (href !== "/dashboard" && pathname.startsWith(`${href}/`));

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold transition-all duration-150 ease-out",
                active
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
