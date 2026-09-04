"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "@/components/ui/sonner";

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
      className="w-(--sidebar-width) min-w-(--sidebar-width) max-w-(--sidebar-width) border-r border-[#16292B] bg-[#0A1517] text-slate-100 shadow-xl select-none"
    >
      {/* Header: Logo & SuperAdmin Switcher */}
      <SidebarHeader className="flex flex-col items-center justify-center p-2 pt-3 pb-2 gap-2 border-b border-white/[0.08]">
        <Link
          href={user?.jobTitle === "marketing" ? "/marketing/campanhas" : "/dashboard"}
          className="flex size-11 items-center justify-center rounded-2xl bg-white/[0.06] border border-white/[0.12] p-1.5 transition-all duration-200 hover:scale-105 hover:bg-white/[0.10] hover:border-emerald-500/40"
          title="Âncora CRM"
        >
          <img src="/icon.png" alt="Ancora" className="size-7 object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" />
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
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs font-semibold bg-[#0E1E20] text-slate-100 border-[#1E3639]">
                Plantão ao vivo ativo
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarHeader>

      {/* Navigation Rail Content */}
      <SidebarContent className="flex-1 px-1 py-2">
        <TooltipProvider delay={150}>
          <nav aria-label="Menu principal" className="flex flex-col items-center gap-1.5 w-full">
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
                        href={itemTargetUrl}
                        prefetch={priorityNavigationPaths.has(itemTargetUrl)}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className="group relative flex w-full flex-col items-center justify-center gap-1 py-1 text-center outline-none select-none transition-transform active:scale-95"
                      />
                    }
                  >
                    {/* BETA badge floating on top */}
                    {item.beta && (
                      <span className="absolute -top-1.5 z-20 rounded-full bg-[#6366F1] px-1.5 py-0.5 text-[8px] font-extrabold text-white tracking-wider shadow-md uppercase">
                        BETA
                      </span>
                    )}

                    {/* Icon Tile */}
                    <div
                      className={cn(
                        "relative flex size-11 items-center justify-center rounded-2xl transition-all duration-200",
                        // Inactive state: crisp light icons on dark slate
                        !isActive && !item.isWhatsApp && "bg-transparent text-slate-300 hover:bg-white/[0.08] hover:text-white",
                        // Active state: glowing emerald container
                        isActive && !item.isWhatsApp && "bg-[#183134] text-emerald-300 border border-emerald-400/40 shadow-[0_0_12px_rgba(16,185,129,0.15)] ring-1 ring-emerald-400/20",
                        // WhatsApp special styling
                        item.isWhatsApp && (
                          isActive
                            ? "border-[1.5px] border-emerald-400 bg-emerald-950/70 text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/30"
                            : "border-[1.5px] border-emerald-500/60 bg-emerald-950/40 text-emerald-300 hover:border-emerald-400 hover:bg-emerald-950/70 shadow-[0_0_8px_rgba(16,185,129,0.15)]"
                        )
                      )}
                    >
                      {isActive && !item.isWhatsApp && (
                        <motion.div
                          layoutId="sidebar-rail-active"
                          className="absolute inset-0 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 pointer-events-none"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                        />
                      )}

                      <Icon
                        weight={isActive ? "fill" : "regular"}
                        className={cn(
                          "size-6 shrink-0 transition-transform duration-200 group-hover:scale-110",
                          isActive ? "text-emerald-300" : "text-slate-200 group-hover:text-white",
                          item.isWhatsApp && "text-emerald-300"
                        )}
                      />

                      {/* Green Status Dot (like WhatsApp) */}
                      {item.statusDot && (
                        <span className="absolute top-0.5 right-0.5 flex size-2.5">
                          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0A1517] shadow-[0_0_8px_#34d399]" />
                        </span>
                      )}
                    </div>

                    {/* Label Text Underneath */}
                    <span
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
                  <TooltipContent side="right" className="font-medium text-xs bg-[#0E1E20] text-slate-100 border-[#1E3639]">
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
                <button
                  type="button"
                  onClick={() => {
                    const event = new CustomEvent("open-agent-drawer");
                    window.dispatchEvent(event);
                  }}
                  className="group relative flex size-11 flex-col items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 transition-all duration-200 hover:scale-105 hover:bg-emerald-500/25 hover:border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)] cursor-pointer"
                />
              }
            >
              <Sparkle weight="fill" className="size-6 text-emerald-400 animate-pulse" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-semibold bg-[#0E1E20] text-slate-100 border-[#1E3639]">
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
                className="size-9 rounded-xl ring-2 ring-emerald-500/40 hover:ring-emerald-400 transition-all"
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="right"
              align="end"
              sideOffset={12}
              className="w-64 p-2.5 rounded-2xl border border-[#1E3639] bg-[#0E1E20] text-slate-100 shadow-2xl backdrop-blur-md"
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
