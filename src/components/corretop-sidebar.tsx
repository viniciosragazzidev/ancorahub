"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "@/components/ui/sonner";

import {
  SquaresFour,
  ChatCircleDots,
  Lightbulb,
  PresentationChart,
  CurrencyCircleDollar,
  UsersThree,
  WhatsappLogo,
  Sparkle,
  CaretDown,
  SignOut,
  SlidersHorizontal,
  UserCircle,
  ShieldCheck,
  Buildings,
  Megaphone,
} from "@phosphor-icons/react";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/user-avatar";
import { signOut } from "@/shared/auth/client";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { type PermissionKey } from "@/shared/auth/permissions";
import { isCurrentUserOnDuty } from "@/features/lead-distribution/on-duty-check";
import { SuperAdminRoleSwitcher } from "@/components/super-admin-role-switcher";
import { cn } from "@/lib/utils";

type NavItemConfig = {
  label: string;
  fullLabel: string;
  icon: typeof SquaresFour;
  url: string;
  permission: PermissionKey;
  isWhatsApp?: boolean;
  beta?: boolean;
  statusDot?: boolean;
};

const navigationItems: NavItemConfig[] = [
  {
    label: "Painel",
    fullLabel: "Dashboard & Visão Geral",
    icon: SquaresFour,
    url: "/dashboard",
    permission: "acessar_dashboard",
  },
  {
    label: "Atendim...",
    fullLabel: "Atendimento & WhatsApp",
    icon: ChatCircleDots,
    url: "/conversas",
    permission: "acessar_conversas",
  },
  {
    label: "Leads",
    fullLabel: "Leads & Oportunidades",
    icon: Lightbulb,
    url: "/leads",
    permission: "acessar_leads",
  },
  {
    label: "Atividades",
    fullLabel: "Distribuição & Roletas",
    icon: PresentationChart,
    url: "/distribuicao",
    permission: "acessar_qualificacao_ia",
  },
  {
    label: "Negocia...",
    fullLabel: "Vendas & Propostas",
    icon: CurrencyCircleDollar,
    url: "/vendas",
    permission: "acessar_vendas",
  },
  {
    label: "Equipe",
    fullLabel: "Equipe & Colaboradores",
    icon: UsersThree,
    url: "/equipe",
    permission: "convidar_corretor",
  },
  {
    label: "Qualificação",
    fullLabel: "Qualificação IA",
    icon: Sparkle,
    url: "/qualificacao",
    permission: "acessar_qualificacao_ia",
  },
  {
    label: "WhatsApp",
    fullLabel: "Conexões WhatsApp",
    icon: WhatsappLogo,
    url: "/settings/whatsapp",
    permission: "acessar_configuracoes_pessoais",
    isWhatsApp: true,
    beta: true,
    statusDot: true,
  },
  {
    label: "Campanhas",
    fullLabel: "Campanhas de Marketing",
    icon: Megaphone,
    url: "/marketing/campanhas",
    permission: "acessar_campanhas_meta",
  },
  {
    label: "Unidades",
    fullLabel: "Filiais & Unidades",
    icon: Buildings,
    url: "/filiais",
    permission: "acessar_configuracoes_unidade",
  },
  {
    label: "Ajustes",
    fullLabel: "Configurações do Sistema",
    icon: SlidersHorizontal,
    url: "/settings",
    permission: "acessar_configuracoes_pessoais",
  },
];

const marketingHiddenPaths = [
  "/conversas",
  "/tarefas",
  "/documentos",
  "/clientes",
  "/vendas",
  "/checklist",
  "/minha-fila",
  "/dashboard",
  "/corretor",
  "/metas",
  "/relatorios",
  "/noc",
  "/filiais",
  "/unidades",
  "/gestor",
  "/diretor",
];

const brokerHiddenPaths = ["/cotacao", "/automacoes", "/filiais", "/unidades"];
const priorityNavigationPaths = new Set(["/dashboard", "/leads", "/conversas", "/clientes"]);
const managerHiddenPaths = [
  "/marketing",
  "/integrations",
  "/inteligencia",
  "/qualificacao",
  "/leads/distribuicao",
  "/automacoes",
];

function canShowItem(item: NavItemConfig, user: UserDisplayInfo | null, roleKey: UserDisplayInfo["roleKey"]) {
  if (!roleKey) return false;
  if (user?.jobTitle === "marketing" && marketingHiddenPaths.some((path) => item.url === path || item.url.startsWith(path + "/"))) {
    return false;
  }
  if (roleKey === "broker" && brokerHiddenPaths.some((path) => item.url === path || item.url.startsWith(path + "/"))) {
    return false;
  }
  if (roleKey === "manager" && managerHiddenPaths.some((path) => item.url === path || item.url.startsWith(path + "/"))) {
    return false;
  }
  return user?.permissions?.includes(item.permission) ?? false;
}

export function CorreTopSidebar({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [user, setUser] = useState<UserDisplayInfo | null>(null);
  const [onDuty, setOnDuty] = useState(false);

  useEffect(() => {
    getUserDisplayInfo().then(setUser);
    isCurrentUserOnDuty().then(setOnDuty);
  }, []);

  const userName = user?.name ?? "Usuário";
  const userRole = user?.role ?? "";
  const roleKey = user?.roleKey ?? null;
  const isPlantaoActive =
    (pathname.startsWith("/distribuicao") && pathname.includes("view=plantao")) ||
    pathname.startsWith("/leads/distribuicao/plantao");

  const visibleItems = navigationItems.filter((item) => canShowItem(item, user, roleKey));

  async function handleLogout() {
    toast.info("Encerrando sua sessão...");
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            window.location.href = "/login";
          },
        },
      });
    } catch {
      // signOut fallback
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <Sidebar
      data-slot="navigation-rail"
      variant="sidebar"
      collapsible="none"
      className="sticky top-0 h-dvh max-h-dvh w-(--sidebar-width) min-w-(--sidebar-width) max-w-(--sidebar-width) overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-none select-none"
    >
      {/* Header: Logo & SuperAdmin Switcher */}
      <SidebarHeader className="flex flex-col items-center justify-center p-2 pt-3 pb-2 gap-2 border-b border-white/[0.08]">
        <Link
          href={user?.jobTitle === "marketing" ? "/marketing/campanhas" : "/dashboard"}
          className="flex size-11 items-center justify-center rounded-[var(--radius-control)] border border-sidebar-border bg-sidebar-accent p-1.5 transition-colors hover:border-emerald-500/40 hover:bg-sidebar-accent/80"
          title="Âncora CRM"
        >
          <img src="/icon.png" alt="Ancora" className="size-7 object-contain" />
        </Link>

        {user?.isPlatformAdmin && (
          <div className="w-full flex justify-center">
            <SuperAdminRoleSwitcher activeOverride={user.activeRoleOverride} />
          </div>
        )}

        {/* Live Duty Pulse Indicator */}
        {onDuty && roleKey !== "manager" && (
          <TooltipProvider delay={150}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Link
                    href="/distribuicao?view=plantao"
                    onClick={() => isMobile && setOpenMobile(false)}
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 transition-colors hover:bg-emerald-500/25",
                      isPlantaoActive && "border-emerald-400 bg-emerald-500/30 ring-2 ring-emerald-400/50"
                    )}
                  />
                }
              >
                <span className="relative flex size-2.5">
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="border-sidebar-border bg-sidebar text-xs font-semibold text-sidebar-foreground">
                Plantão ao vivo ativo
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarHeader>

      {/* Navigation Rail Content */}
      <SidebarContent className="flex-1 min-h-0 px-1 py-1">
        <TooltipProvider delay={150}>
          <nav aria-label="Menu principal" className="flex flex-col items-center gap-1.5 w-full pb-4">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.url ||
                (item.url !== "/dashboard" && pathname.startsWith(item.url + "/")) ||
                (item.url.startsWith("/marketing") && pathname.startsWith("/marketing"));

              const itemTargetUrl =
                item.url === "/filiais" && user?.roleKey === "manager" && user?.branchId
                  ? `/unidades/${user.branchId}`
                  : item.url;

              return (
                <Tooltip key={item.url}>
                  <TooltipTrigger
                    render={
                      <Link
                        data-slot="rail-link"
                        href={itemTargetUrl}
                        aria-current={isActive ? "page" : undefined}
                        prefetch={priorityNavigationPaths.has(itemTargetUrl)}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className="group relative flex w-full flex-col items-center justify-center gap-1 py-1 text-center outline-none select-none transition-transform active:scale-95"
                      />
                    }
                  >
                    {/* BETA badge floating on top */}
                    {item.beta && (
                      <span className="absolute -top-1.5 z-20 rounded-full bg-primary px-1.5 py-0.5 text-[8px] font-extrabold tracking-wider text-primary-foreground uppercase">
                        BETA
                      </span>
                    )}

                    {/* Icon Tile */}
                    <div
                      data-slot="rail-tile"
                      className={cn(
                        "relative flex size-11 items-center justify-center rounded-[var(--radius-control)] border border-transparent transition-colors duration-[var(--duration-quick)]",
                        // Inactive state: crisp light icons on dark slate
                        !isActive && !item.isWhatsApp && "bg-transparent text-slate-300 hover:bg-white/[0.08] hover:text-white",
                        // Active state: glowing emerald container
                        isActive && !item.isWhatsApp && "border-emerald-400/40 bg-sidebar-accent text-emerald-300",
                        // WhatsApp special styling
                        item.isWhatsApp && (
                          isActive
                            ? "border-emerald-400 bg-emerald-950/70 text-emerald-300"
                            : "border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-950/70"
                        )
                      )}
                    >
                      <Icon
                        weight={isActive ? "fill" : "regular"}
                        className={cn(
                          "size-6 shrink-0",
                          isActive ? "text-emerald-300" : "text-slate-200 group-hover:text-white",
                          item.isWhatsApp && "text-emerald-300"
                        )}
                      />

                      {/* Green Status Dot (like WhatsApp) */}
                      {item.statusDot && (
                        <span className="absolute top-0.5 right-0.5 flex size-2.5">
                          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
                        </span>
                      )}
                    </div>

                    {/* Label Text Underneath */}
                    <span
                      data-slot="rail-label"
                      className={cn(
                        "max-w-[70px] truncate text-[10px] font-medium leading-tight tracking-tight transition-colors",
                        isActive
                          ? "font-semibold text-emerald-300"
                          : "text-slate-400 group-hover:text-slate-100",
                        item.isWhatsApp && (isActive ? "text-emerald-300 font-semibold" : "text-emerald-300/90")
                      )}
                    >
                      {item.label}
                    </span>

                    {/* Active Chevron Indicator */}
                    {isActive && (
                      <CaretDown className="size-2.5 text-emerald-400 -mt-0.5" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="border-sidebar-border bg-sidebar text-xs font-medium text-sidebar-foreground">
                    {item.fullLabel || item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>
      </SidebarContent>

      {/* Footer: AI Agent & User Profile */}
      <SidebarFooter className="flex flex-col items-center justify-center p-2 pb-3 gap-2 border-t border-white/[0.08]">
        <TooltipProvider delay={150}>
          {/* AI Agent Trigger */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="icon-lg"
                  variant="ghost"
                  aria-label="Abrir Agente IA"
                  onClick={() => {
                    const event = new CustomEvent("open-agent-drawer");
                    window.dispatchEvent(event);
                  }}
                  className="size-11 rounded-[var(--radius-control)] border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:border-emerald-400 hover:bg-emerald-500/25"
                />
              }
            >
              <Sparkle weight="fill" className="size-6 text-emerald-400" />
            </TooltipTrigger>
            <TooltipContent side="right" className="border-sidebar-border bg-sidebar text-xs font-semibold text-sidebar-foreground">
              Agente IA (Ctrl+J)
            </TooltipContent>
          </Tooltip>

          {/* User Profile Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="icon-lg"
                  variant="ghost"
                  aria-label="Abrir menu do perfil"
                  className="size-10 rounded-[var(--radius-control)] text-sidebar-foreground hover:bg-sidebar-accent"
                />
              }
            >
              <UserAvatar
                seed={userName}
                name={userName}
                size="sm"
                className="size-9 rounded-[var(--radius-control)] ring-1 ring-emerald-500/40"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={12}
              className="w-64 rounded-[var(--radius-card)] border border-sidebar-border bg-sidebar p-2.5 text-sidebar-foreground shadow-[var(--shadow-dialog)]"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-2">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      seed={userName}
                      name={userName}
                      size="sm"
                      className="size-10 shrink-0 rounded-xl ring-2 ring-emerald-500/40 shadow-xs"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-semibold tracking-tight text-white">
                        {userName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                        >
                          <ShieldCheck className="size-3 text-emerald-400" />
                          {userRole}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator className="bg-white/10" />
              {user?.userProfileEnabled ? (
                <DropdownMenuItem
                  render={<Link href="/settings?tab=conta" />}
                  className="text-slate-200 focus:bg-white/10 focus:text-white"
                >
                  <UserCircle className="size-4 text-emerald-400" />
                  Meu perfil
                </DropdownMenuItem>
              ) : null}
              {roleKey &&
              (user?.permissions?.includes("acessar_configuracoes") ||
                user?.permissions?.includes("acessar_configuracoes_pessoais") ||
                roleKey === "broker") ? (
                <DropdownMenuItem
                  render={<Link href="/settings" />}
                  className="text-slate-200 focus:bg-white/10 focus:text-white"
                >
                  <SlidersHorizontal className="size-4 text-emerald-400" />
                  Configurações
                </DropdownMenuItem>
              ) : null}
              {userRole === "broker" || roleKey === "broker" || user?.jobTitle === "broker" ? (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <div className="px-1 py-1">
                    <ExperienceModeToggle variant="menu-item" />
                  </div>
                </>
              ) : null}
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem
                variant="destructive"
                onClick={handleLogout}
                className="text-red-400 focus:bg-red-500/15 focus:text-red-300"
              >
                <SignOut className="size-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipProvider>
      </SidebarFooter>
    </Sidebar>
  );
}
