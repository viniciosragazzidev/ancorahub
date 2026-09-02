"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatCircleText, House, ListChecks, Users } from "@/components/huge-icons";
import { cn } from "@/lib/utils";

export function LightBottomNav({
  awaitingResponse = 0,
  criticalLeads = 0,
}: {
  awaitingResponse?: number;
  criticalLeads?: number;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const tabs = [
    { href: "/dashboard", label: "Início", icon: House, badge: 0 },
    { href: "/minha-fila", label: "Fila", icon: ListChecks, badge: criticalLeads },
    { href: "/conversas/broker", label: "Chat", icon: ChatCircleText, badge: awaitingResponse },
    { href: "/clientes", label: "Clientes", icon: Users, badge: 0 },
  ] as const;

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/70 bg-card/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="mx-auto flex max-w-4xl items-stretch">
        {tabs.map(({ href, label, icon: Icon, badge }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="relative">
                <Icon className={cn("size-5", active && "[stroke-width:2.2]")} />
                {badge > 0 && (
                  <span
                    aria-label={`${badge} pendente${badge > 1 ? "s" : ""}`}
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground"
                  >
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span className={cn(active && "font-semibold")}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
