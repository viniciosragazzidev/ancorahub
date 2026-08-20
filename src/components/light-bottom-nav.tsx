"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircleText, Gear, House, ListChecks, Users } from "@/components/huge-icons";
import { Dock, DockIcon } from "@/components/ui/dock";
import { cn } from "@/lib/utils";

const LIGHT_NAV_ITEMS = [
  { label: "Resumo", href: "/dashboard", icon: House },
  { label: "Leads", href: "/minha-fila", icon: ListChecks },
  { label: "Conversas", href: "/conversas/broker", icon: ChatCircleText },
  { label: "Clientes", href: "/clientes", icon: Users },
  { label: "Config", href: "/settings", icon: Gear },
] as const;

export function LightBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegação Light do Corretor"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <Dock className="pointer-events-auto">
        {LIGHT_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active =
            pathname === href ||
            (href === "/minha-fila" && pathname.startsWith("/leads")) ||
            (href !== "/dashboard" && pathname.startsWith(`${href}/`));

          return (
            <DockIcon
              key={href}
              aria-label={label}
              title={label}
              className={cn(
                "relative text-foreground",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon aria-hidden="true" className="size-6" />
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"
                />
              ) : null}
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className="absolute inset-0 rounded-full"
              >
                <span className="sr-only">{label}</span>
              </Link>
            </DockIcon>
          );
        })}
      </Dock>
    </nav>
  );
}
