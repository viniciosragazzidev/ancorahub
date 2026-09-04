"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  SquaresFour,
  ChatCircleDots,
  Lightbulb,
  PresentationChart,
  CurrencyCircleDollar,
  UsersThree,
  Clock,
  WhatsappLogo,
  Sparkle,
  CaretDown,
  SignOut,
  SlidersHorizontal,
  UserCircle,
  ShieldCheck,
  Buildings,
  Megaphone,
  Plug,
  WifiHigh,
} from "@phosphor-icons/react";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";
import { AncoraLogo } from "@/components/ancora-logo";
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
    label: "Contatos",
    fullLabel: "Equipe & Colaboradores",
    icon: UsersThree,
    url: "/equipe",
    permission: "convidar_corretor",
  },
  {
    label: "Tarefas",
    fullLabel: "Relatórios & Métricas",
    icon: Clock,
    url: "/relatorios",
    permission: "acessar_relatorios",
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
      variant="sidebar"
      collapsible="none"
      className="w-(--sidebar-width) min-w-(--sidebar-width) max-w-(--sidebar-width) border-r border-sidebar-border/50 bg-[#0A1415] text-sidebar-foreground shadow-xs select-none"
    >
      {/* Header: Logo & SuperAdmin Switcher */}
      <SidebarHeader className="flex flex-col items-center justify-center p-2 pt-3 pb-2 gap-2 border-b border-sidebar-border/30">
        <Link
          href={user?.jobTitle === "marketing" ? "/marketing/campanhas" : "/dashboard"}
          className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-accent/40 p-1.5 transition-transform hover:scale-105"
          title="Âncora CRM"
        >
          <img src="/icon.png" alt="Ancora" className="size-7 object-contain drop-shadow-sm" />
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
                      "relative flex size-9 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 transition-colors hover:bg-emerald-500/20",
                      isPlantaoActive && "border-emerald-500 bg-emerald-500/25 ring-2 ring-emerald-500/40"
                    )}
                  />
                }
              >
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-semibold">
                Plantão ao vivo ativo
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarHeader>

      {/* Navigation Rail Content */}
      <SidebarContent className="flex-1 overflow-y-auto px-1 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <TooltipProvider delay={150}>
          <nav aria-label="Menu principal" className="flex flex-col items-center gap-1.5 w-full">
            {visibleItems.map((item, index) => {
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
                        href={itemTargetUrl}
                        prefetch={priorityNavigationPaths.has(itemTargetUrl)}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className="group relative flex w-full flex-col items-center justify-center gap-0.5 py-1 text-center outline-none select-none transition-transform active:scale-95"
                      />
                    }
                  >
                    {/* BETA badge floating on top */}
                    {item.beta && (
                      <span className="absolute -top-1 right-2 z-20 rounded bg-indigo-600 px-1 py-0.2 text-[8px] font-bold text-white tracking-wide shadow-xs uppercase">
                        BETA
                      </span>
                    )}

                    {/* Icon Tile */}
                    <div
                      className={cn(
                        "relative flex size-11 items-center justify-center rounded-2xl transition-all duration-200",
                        isActive
                          ? "bg-primary/20 text-primary border border-primary/30 shadow-xs dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30"
                          : "text-muted-foreground/80 hover:bg-sidebar-accent/70 hover:text-foreground",
                        item.isWhatsApp && (
                          isActive
                            ? "border-2 border-emerald-500 bg-emerald-500/20 text-emerald-400"
                            : "border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 hover:border-emerald-500 hover:bg-emerald-500/20"
                        )
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-rail-active"
                          className="absolute inset-0 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 pointer-events-none"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}

                      <Icon
                        weight={isActive ? "fill" : "regular"}
                        className={cn(
                          "size-5.5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive ? "text-primary dark:text-emerald-400" : "text-sidebar-foreground/75"
                        )}
                      />

                      {/* Green Status Dot (like WhatsApp) */}
                      {item.statusDot && (
                        <span className="absolute top-1 right-1 flex size-2">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2 rounded-full bg-emerald-500 ring-2 ring-background" />
                        </span>
                      )}
                    </div>

                    {/* Label Text Underneath */}
                    <span
                      className={cn(
                        "max-w-[70px] truncate text-[10px] font-medium leading-tight tracking-tight transition-colors",
                        isActive
                          ? "font-semibold text-foreground dark:text-emerald-400"
                          : "text-sidebar-foreground/60 group-hover:text-foreground"
                      )}
                    >
                      {item.label}
                    </span>

                    {/* Active Chevron Indicator */}
                    {isActive && (
                      <CaretDown className="size-2.5 text-primary/70 dark:text-emerald-400/70 -mt-0.5" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium text-xs">
                    {item.fullLabel || item.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </nav>
        </TooltipProvider>
      </SidebarContent>

      {/* Footer: AI Agent & User Profile */}
      <SidebarFooter className="flex flex-col items-center justify-center p-2 pb-3 gap-2 border-t border-sidebar-border/30">
        <TooltipProvider delay={150}>
          {/* AI Agent Trigger */}
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => {
                    const event = new CustomEvent("open-agent-drawer");
                    window.dispatchEvent(event);
                  }}
                  className="group relative flex size-11 flex-col items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary transition-all duration-200 hover:scale-105 hover:bg-primary/20 hover:border-primary/40 cursor-pointer"
                />
              }
            >
              <Sparkle weight="fill" className="size-5.5 text-primary animate-pulse" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-semibold">
              Agente IA (Ctrl+J)
            </TooltipContent>
          </Tooltip>

          {/* User Profile Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="relative flex size-10 items-center justify-center rounded-2xl transition-transform hover:scale-105 outline-none cursor-pointer"
                />
              }
            >
              <UserAvatar
                seed={userName}
                name={userName}
                size="sm"
                className="size-9 rounded-xl ring-2 ring-border/80 hover:ring-primary/40 transition-all"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={12}
              className="w-64 p-2.5 rounded-2xl border border-border/80 bg-card/95 backdrop-blur-md shadow-xl"
            >
              <DropdownMenuGroup>
                <DropdownMenuLabel className="p-2">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      seed={userName}
                      name={userName}
                      size="sm"
                      className="size-10 shrink-0 rounded-xl ring-2 ring-primary/20 shadow-xs"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                        {userName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                        >
                          <ShieldCheck className="size-3 text-primary" />
                          {userRole}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              {user?.userProfileEnabled ? (
                <DropdownMenuItem render={<Link href="/settings?tab=conta" />}>
                  <UserCircle className="size-4" />
                  Meu perfil
                </DropdownMenuItem>
              ) : null}
              {roleKey &&
              (user?.permissions?.includes("acessar_configuracoes") ||
                user?.permissions?.includes("acessar_configuracoes_pessoais") ||
                roleKey === "broker") ? (
                <DropdownMenuItem render={<Link href="/settings" />}>
                  <SlidersHorizontal className="size-4" />
                  Configurações
                </DropdownMenuItem>
              ) : null}
              {userRole === "broker" || roleKey === "broker" || user?.jobTitle === "broker" ? (
                <>
                  <DropdownMenuSeparator />
                  <div className="px-1 py-1">
                    <ExperienceModeToggle variant="menu-item" />
                  </div>
                </>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={handleLogout}>
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
