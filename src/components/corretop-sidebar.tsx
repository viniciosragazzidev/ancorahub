"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { routePermissionForPath } from "@/features/custom-roles/routes";

type NavItemConfig = {
  label: string;
  fullLabel: string;
  icon: typeof SquaresFour;
  url: string;
  permission: PermissionKey;
  section: "Principal" | "Operação" | "Marketing" | "Administração";
  iconTone: string;
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
    section: "Principal",
    iconTone: "text-sky-600 dark:text-sky-300",
  },
  {
    label: "Conversas",
    fullLabel: "Atendimento e WhatsApp",
    icon: ChatCircleDots,
    url: "/conversas",
    permission: "acessar_conversas",
    section: "Principal",
    iconTone: "text-violet-600 dark:text-violet-300",
  },
  {
    label: "Leads",
    fullLabel: "Leads & Oportunidades",
    icon: Lightbulb,
    url: "/leads",
    permission: "acessar_leads",
    section: "Principal",
    iconTone: "text-amber-600 dark:text-amber-300",
  },
  {
    label: "Distribuição",
    fullLabel: "Distribuição de leads e roletas",
    icon: PresentationChart,
    url: "/distribuicao",
    permission: "acessar_qualificacao_ia",
    section: "Operação",
    iconTone: "text-emerald-600 dark:text-emerald-300",
  },
  {
    label: "Vendas",
    fullLabel: "Vendas e propostas",
    icon: CurrencyCircleDollar,
    url: "/vendas",
    permission: "acessar_vendas",
    section: "Operação",
    iconTone: "text-orange-600 dark:text-orange-300",
  },
  {
    label: "Equipe",
    fullLabel: "Equipe & Colaboradores",
    icon: UsersThree,
    url: "/equipe",
    permission: "convidar_corretor",
    section: "Operação",
    iconTone: "text-cyan-600 dark:text-cyan-300",
  },
  {
    label: "Qualificação",
    fullLabel: "Qualificação IA",
    icon: Sparkle,
    url: "/qualificacao",
    permission: "acessar_qualificacao_ia",
    section: "Marketing",
    iconTone: "text-fuchsia-600 dark:text-fuchsia-300",
  },
  {
    label: "WhatsApp",
    fullLabel: "Conexões WhatsApp",
    icon: WhatsappLogo,
    url: "/integrations/whatsapp",
    permission: "acessar_configuracoes_pessoais",
    section: "Marketing",
    iconTone: "text-green-600 dark:text-green-300",
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
    section: "Marketing",
    iconTone: "text-blue-600 dark:text-blue-300",
  },
  {
    label: "Unidades",
    fullLabel: "Filiais & Unidades",
    icon: Buildings,
    url: "/filiais",
    permission: "acessar_configuracoes_unidade",
    section: "Administração",
    iconTone: "text-indigo-600 dark:text-indigo-300",
  },
  {
    label: "Ajustes",
    fullLabel: "Configurações do Sistema",
    icon: SlidersHorizontal,
    url: "/settings",
    permission: "acessar_configuracoes_pessoais",
    section: "Administração",
    iconTone: "text-slate-600 dark:text-slate-300",
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
const priorityNavigationPaths = new Set(["/dashboard", "/leads", "/conversas", "/clientes", "/vendas"]);
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
  const permissions = user?.permissions ?? [];
  const routePermission = routePermissionForPath(item.url);
  const explicitRoutes = permissions.filter((permission) => permission.startsWith("route:"));
  if (routePermission && explicitRoutes.length > 0) return permissions.includes(routePermission);
  return permissions.includes(item.permission);
}

export function CorreTopSidebar({ logoUrl }: { logoUrl?: string | null }) {
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
      variant="floating"
      collapsible="icon"
      className="sticky top-0 h-dvh max-h-dvh overflow-hidden select-none"
    >
      {/* Header: Logo & SuperAdmin Switcher */}
      <SidebarHeader className={cn("gap-3 border-b border-sidebar-border/70 p-3", isMobile ? "min-h-[calc(4rem+var(--mobile-safe-top))] flex-row px-4 pt-[calc(0.75rem+var(--mobile-safe-top))] pr-14" : "")}>
        <div className="flex min-w-0 items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <Link
            href={user?.jobTitle === "marketing" ? "/marketing/campanhas" : "/dashboard"}
            className="flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-sidebar-border bg-sidebar-accent p-1.5 shadow-xs transition-[background-color,border-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-sidebar-ring/50 hover:bg-sidebar-accent/80 active:scale-[0.96] motion-reduce:transition-none"
            title="Âncora CRM"
          >
            <img src={logoUrl || "/icon.png"} alt="Âncora CRM" className="size-7 object-contain" />
          </Link>
          <div className="min-w-0 transition-[opacity,transform,max-width] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
            <p className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Âncora CRM</p>
            <p className="truncate text-[11px] text-sidebar-foreground/55">Menu principal</p>
          </div>
        </div>

        {isMobile ? (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-sidebar-foreground">Menu principal</p>
            <p className="truncate text-xs text-sidebar-foreground/55">{userName}</p>
          </div>
        ) : null}

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
                      "relative flex w-full items-center gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-emerald-700 transition-colors hover:bg-emerald-500/25 dark:text-emerald-300 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0",
                      isPlantaoActive && "border-emerald-400 bg-emerald-500/30 ring-2 ring-emerald-400/50"
                    )}
                  />
                }
              >
                <span className="relative flex size-2.5 shrink-0">
                  <span className="relative inline-flex size-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium transition-[max-width,opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                  Área de Plantão
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="border-sidebar-border bg-sidebar text-xs font-semibold text-sidebar-foreground">
                Plantão ao vivo ativo
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent className={cn("min-h-0 flex-1 py-2", isMobile ? "px-2" : "px-2")}>
        <TooltipProvider delay={150}>
          <nav aria-label="Menu principal" className="flex w-full flex-col gap-1 pb-4">
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

              const previousItem = visibleItems[index - 1];
              const showSection = !previousItem || previousItem.section !== item.section;

              return (
                <div key={item.url} className="flex flex-col">
                  {showSection ? (
                    <p className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45 transition-[margin,opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] first:mt-1 group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                      {item.section}
                    </p>
                  ) : null}
                  <Tooltip>
                  <TooltipTrigger
                    render={
                      <Link
                        data-slot="sidebar-nav-link"
                        href={itemTargetUrl}
                        aria-current={isActive ? "page" : undefined}
                        prefetch={priorityNavigationPaths.has(itemTargetUrl)}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className={cn(
                          "group relative flex min-h-10 w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 outline-none select-none transition-[background-color,color,border-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-sidebar-accent/75 focus-visible:ring-2 focus-visible:ring-sidebar-ring/50 active:scale-[0.98] motion-reduce:transition-none",
                          isMobile && "min-h-(--mobile-touch-target)",
                          isActive && "bg-sidebar-accent text-sidebar-accent-foreground shadow-xs",
                          !isMobile && "group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-11 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
                        )}
                      />
                    }
                  >
                    {/* Contextual icon */}
                    <div
                      data-slot="sidebar-nav-icon"
                      className={cn(
                        "relative flex size-8 shrink-0 items-center justify-center rounded-[0.55rem] transition-[background-color,color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-hover:scale-[1.04] motion-reduce:transition-none",
                        !isActive && !item.isWhatsApp && `${item.iconTone} bg-sidebar-accent/55`,
                        isActive && "bg-sidebar-primary/12 text-sidebar-primary",
                        item.isWhatsApp && "bg-emerald-500/12 text-emerald-600 dark:text-emerald-300",
                      )}
                    >
                      <Icon
                        weight={isActive ? "fill" : "regular"}
                        className={cn(
                          "size-[1.15rem] shrink-0 transition-[color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none",
                          isActive ? "text-sidebar-primary" : item.isWhatsApp ? "text-emerald-600 dark:text-emerald-300" : item.iconTone,
                        )}
                      />

                      {/* Green Status Dot (like WhatsApp) */}
                      {item.statusDot && (
                        <span className="absolute top-0.5 right-0.5 flex size-2.5">
                          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500 ring-2 ring-sidebar" />
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    <span
                      data-slot="sidebar-nav-label"
                      className={cn(
                        "min-w-0 flex-1 truncate text-sm leading-tight tracking-tight transition-[max-width,opacity,transform,color] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] motion-reduce:transition-none",
                        isActive ? "font-semibold text-sidebar-accent-foreground" : "font-medium text-sidebar-foreground/72 group-hover:text-sidebar-accent-foreground",
                        !isMobile && "group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0",
                      )}
                    >
                      {item.label}
                    </span>

                    {item.beta ? (
                      <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.08em] text-primary uppercase group-data-[collapsible=icon]:hidden">
                        Beta
                      </span>
                    ) : null}

                    {/* Active marker */}
                    {isActive && !isMobile && (
                      <CaretDown className="size-3 shrink-0 -rotate-90 text-sidebar-primary transition-transform duration-[var(--duration-quick)] group-data-[collapsible=icon]:hidden motion-reduce:transition-none" />
                    )}
                  </TooltipTrigger>
                  <TooltipContent side="right" className="border-sidebar-border bg-popover text-xs font-medium text-popover-foreground shadow-md">
                    {item.fullLabel || item.label}
                  </TooltipContent>
                  </Tooltip>
                </div>
              );
            })}
          </nav>
        </TooltipProvider>
      </SidebarContent>

      {/* Footer: AI Agent & User Profile */}
      <SidebarFooter className={cn("gap-1 border-t border-sidebar-border/70 p-2 pb-3", isMobile ? "flex-row justify-between px-4 pb-[max(0.75rem,var(--mobile-safe-bottom))]" : "")}>
        <TooltipProvider delay={150}>
          {/* AI Agent Trigger */}
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  size="default"
                  variant="ghost"
                  aria-label="Abrir Agente IA"
                  onClick={() => {
                    const event = new CustomEvent("open-agent-drawer");
                    window.dispatchEvent(event);
                  }}
                  className="h-10 w-full justify-start gap-3 rounded-[var(--radius-control)] border border-emerald-500/25 bg-emerald-500/10 px-3 text-emerald-700 shadow-xs transition-[background-color,border-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:border-emerald-500/45 hover:bg-emerald-500/15 active:scale-[0.98] dark:text-emerald-300 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 motion-reduce:transition-none"
                />
              }
            >
              <Sparkle weight="fill" className="size-[1.15rem] shrink-0" />
              <span className="truncate text-sm font-medium transition-[max-width,opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">Agente IA</span>
            </TooltipTrigger>
            <TooltipContent side="right" className="border-sidebar-border bg-popover text-xs font-semibold text-popover-foreground shadow-md">
              Agente IA (Ctrl+J)
            </TooltipContent>
          </Tooltip>

          {/* User Profile Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  type="button"
                  size="default"
                  variant="ghost"
                  aria-label="Abrir menu do perfil"
                  className="h-10 w-full justify-start gap-3 rounded-[var(--radius-control)] px-2 text-sidebar-foreground transition-[background-color,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] hover:bg-sidebar-accent active:scale-[0.98] group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0 motion-reduce:transition-none"
                />
              }
            >
              <UserAvatar
                seed={userName}
                name={userName}
                size="sm"
                className="size-9 rounded-[var(--radius-control)] ring-1 ring-emerald-500/40"
              />
              <span className="min-w-0 flex-1 text-left transition-[max-width,opacity,transform] duration-[var(--duration-quick)] ease-[var(--ease-smooth-out)] group-data-[collapsible=icon]:pointer-events-none group-data-[collapsible=icon]:max-w-0 group-data-[collapsible=icon]:-translate-x-2 group-data-[collapsible=icon]:opacity-0 motion-reduce:transition-none">
                <span className="block truncate text-sm font-medium">{userName}</span>
                <span className="block truncate text-[11px] text-sidebar-foreground/55">{userRole || "Conta"}</span>
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={isMobile ? "top" : "right"}
              align={isMobile ? "start" : "end"}
              sideOffset={12}
              className="w-64 rounded-[var(--radius-card)] border border-border bg-popover p-2.5 text-popover-foreground shadow-[var(--shadow-dialog)]"
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
                      <span className="truncate text-sm font-semibold tracking-tight text-popover-foreground">
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
              <DropdownMenuSeparator className="bg-border" />
              {user?.userProfileEnabled ? (
                <DropdownMenuItem
                  render={<Link href="/settings?tab=conta" />}
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
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
                  className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
                >
                  <SlidersHorizontal className="size-4 text-emerald-400" />
                  Configurações
                </DropdownMenuItem>
              ) : null}
              {userRole === "broker" || roleKey === "broker" || user?.jobTitle === "broker" ? (
                <>
                  <DropdownMenuSeparator className="bg-border" />
                  <div className="px-1 py-1">
                    <ExperienceModeToggle variant="menu-item" />
                  </div>
                </>
              ) : null}
              <DropdownMenuSeparator className="bg-border" />
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
