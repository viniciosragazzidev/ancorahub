"use client";

import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  PauseCircle,
  ChevronDown,
  LogOut,
  Settings,
  Home,
  ListChecks,
  MessageSquare,
  Users,
  Menu,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOut } from "@/shared/auth/client";
import { updateBrokerAvailabilityAction } from "@/features/leads/availability-action";
import { toast } from "@/components/ui/sonner";

export type LightTopNavProps = {
  branding?: {
    tenantName: string | null;
    brandColor: string | null;
    logoUrl: string | null;
  };
  user?: {
    name: string | null;
    email: string | null;
    role?: string;
  };
  showConversations?: boolean;
  initialAvailability?: "available" | "paused" | "offline";
};

export function LightTopNavBar({
  branding,
  user,
  showConversations = true,
  initialAvailability = "available",
}: LightTopNavProps) {
  const pathname = usePathname();
  const [availability, setAvailability] = useState(initialAvailability);
  const [isPending, startTransition] = useTransition();

  const isTabActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const navItems = [
    { href: "/dashboard", label: "Início", icon: Home },
    { href: "/minha-fila", label: "Minha Fila", icon: ListChecks },
    ...(showConversations
      ? [{ href: "/conversas/broker", label: "Insights", icon: MessageSquare }]
      : []),
    { href: "/clientes", label: "Clientes", icon: Users },
  ];

  function toggleAvailability() {
    const nextStatus = availability === "available" ? "paused" : "available";
    startTransition(async () => {
      try {
        await updateBrokerAvailabilityAction(nextStatus);
        setAvailability(nextStatus);
        toast.success(
          nextStatus === "available"
            ? "Você está disponível para receber novos leads."
            : "Você pausou o recebimento de leads.",
        );
      } catch {
        toast.error("Não foi possível alterar a disponibilidade.");
      }
    });
  }

  const userInitials = (user?.name || "Corretor")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  // Close mobile menu on route change
  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!mobileMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        closeMobileMenu();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuOpen, closeMobileMenu]);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-primary/20 bg-primary text-primary-foreground shadow-sm select-none">
      <div className="mx-auto flex h-14 w-full items-center justify-between px-3 sm:px-5 gap-3">
        {/* LADO ESQUERDO: LOGO + NAVEGAÇÃO HORIZONTAL */}
        <div className="flex items-center gap-3 sm:gap-6 min-w-0">
          {/* LOGO DA CORRETORA */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 shrink-0 group transition-opacity hover:opacity-95"
            aria-label="Ir para o início"
          >
            {branding?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.logoUrl}
                alt={branding.tenantName || "Logo"}
                className="h-7 w-auto object-contain brightness-0 invert"
              />
            ) : (
              <div className="grid size-7 place-items-center rounded-lg bg-white/20 text-white font-black text-xs">
                ⚓
              </div>
            )}
          </Link>

          {/* ITENS DE NAVEGAÇÃO — desktop */}
          <nav className="hidden md:flex items-center gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none]">
            {navItems.map((item) => {
              const active = isTabActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-all shrink-0",
                    active
                      ? "bg-white/25 text-white font-bold shadow-xs backdrop-blur-xs"
                      : "text-white/80 hover:bg-white/15 hover:text-white",
                  )}
                >
                  <Icon className={cn("size-4", active ? "stroke-[2.5]" : "stroke-[1.75]")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* BOTÃO HAMBURGUER — mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden flex items-center justify-center size-8 rounded-lg hover:bg-white/15 transition-colors cursor-pointer"
            aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {/* LADO DIREITO: DISPONIBILIDADE + IDENTIFICAÇÃO + PERFIL */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* BOTÃO DE STATUS / DISPONIBILIDADE */}
          <button
            type="button"
            onClick={toggleAvailability}
            disabled={isPending}
            title={availability === "available" ? "Clique para pausar" : "Clique para ficar disponível"}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-all cursor-pointer",
              availability === "available"
                ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40 hover:bg-emerald-500/30"
                : "bg-amber-500/25 text-amber-100 border-amber-400/50 hover:bg-amber-500/35",
            )}
          >
            {availability === "available" ? (
              <>
                <CheckCircle2 className="size-3 text-emerald-300 fill-emerald-300/30" />
                <span className="hidden sm:inline">Disponível</span>
              </>
            ) : (
              <>
                <PauseCircle className="size-3 text-amber-300 fill-amber-300/30" />
                <span className="hidden sm:inline">Pausado</span>
              </>
            )}
          </button>

          {/* MENU DE PERFIL DO USUÁRIO */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex items-center gap-2 rounded-lg p-1 hover:bg-white/15 transition-colors cursor-pointer outline-hidden"
              aria-label="Menu do usuário"
            >
              <div className="grid size-7 place-items-center rounded-full bg-white text-primary font-bold text-xs shadow-xs">
                {userInitials || "CO"}
              </div>
              <div className="hidden xl:flex flex-col text-left text-xs leading-tight">
                <span className="font-semibold text-white truncate max-w-[120px]">
                  {user?.name || "Corretor"}
                </span>
                <span className="text-[10px] text-white/75 truncate max-w-[120px]">
                  {user?.email || ""}
                </span>
              </div>
              <ChevronDown className="size-3.5 text-white/80" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 mt-1">
              <DropdownMenuLabel className="font-normal px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[13px] font-semibold leading-tight tracking-tight text-foreground truncate">{user?.name || "Corretor"}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground truncate">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/settings" className="cursor-pointer" />}>
                <Settings className="mr-2 size-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:text-destructive cursor-pointer font-medium"
              >
                <LogOut className="mr-2 size-4" />
                <span>Sair da conta</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* MENU MOBILE DROPDOWN */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden border-t border-white/20 bg-primary animate-in slide-in-from-top-2 fade-in duration-150"
        >
          <nav className="flex flex-col p-2 gap-0.5">
            <Link
              href="/settings"
              onClick={closeMobileMenu}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/15 hover:text-white transition-all"
            >
              <Settings className="size-4.5" />
              <span>Configurações</span>
            </Link>
            <div className="my-1 border-t border-white/15" />
            <button
              type="button"
              onClick={() => {
                closeMobileMenu();
                signOut();
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-white/80 hover:bg-white/15 hover:text-white transition-all cursor-pointer"
            >
              <LogOut className="size-4.5" />
              <span>Sair da conta</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
