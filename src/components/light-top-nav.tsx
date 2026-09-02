"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckCircle2,
  PauseCircle,
  ChevronDown,
  LogOut,
  Home,
  ListChecks,
  MessageSquare,
  Users,
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
import { toast } from "sonner";

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
      ? [{ href: "/conversas/broker", label: "Conversas", icon: MessageSquare }]
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

  const tenantInitials = (branding?.tenantName || "Âncora")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

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
            <span className="font-bold text-sm tracking-tight text-white hidden md:inline truncate max-w-[150px]">
              {branding?.tenantName || "Âncora Corretora"}
            </span>
          </Link>

          {/* ITENS DE NAVEGAÇÃO (ESTILO HORIZONTAL TABS) */}
          <nav className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto [scrollbar-width:none]">
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

          {/* BADGE DA CORRETORA/TENANT */}
          <div className="hidden lg:flex items-center gap-1.5 rounded-lg bg-white/15 border border-white/20 px-2 py-1 text-xs text-white">
            <span className="grid size-4 place-items-center rounded bg-white text-primary text-[9px] font-bold">
              {tenantInitials || "AC"}
            </span>
            <span className="truncate max-w-[120px] font-medium text-[11px]">
              {branding?.tenantName || "Corretora"}
            </span>
          </div>

          <div className="h-5 w-px bg-white/25 hidden sm:block" />

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
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none">{user?.name || "Corretor"}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/minha-fila" className="cursor-pointer" />}>
                <ListChecks className="mr-2 size-4" />
                <span>Minha Fila</span>
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/clientes" className="cursor-pointer" />}>
                <Users className="mr-2 size-4" />
                <span>Meus Clientes</span>
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
    </header>
  );
}
