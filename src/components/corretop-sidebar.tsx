"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import {
  BookOpen,
  Buildings,
  ChartBar,
  ChatCircleText,
  ClipboardText,
  CurrencyCircleDollar,
  FileArrowDown,
  FolderSimple,
  Handshake,
  House,
  Megaphone,
  Monitor,
  Note,
  Plug,
  Redistribute,
  SignOut,
  SlidersHorizontal,
  Target,
  Users,
  UserCircle,
  WifiHigh,
} from "@/components/huge-icons";
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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { UserAvatar } from "@/components/ui/user-avatar";
import { signOut } from "@/shared/auth/client";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { type PermissionKey } from "@/shared/auth/permissions";
import { isCurrentUserOnDuty } from "@/features/lead-distribution/on-duty-check";
import { SuperAdminRoleSwitcher } from "@/components/super-admin-role-switcher";

import { Sparkle } from "@phosphor-icons/react";

type SidebarItem = { label: string; icon: typeof House | typeof Sparkle; url: string; permission: PermissionKey };
type SidebarSection = { label: string; items: SidebarItem[] };

const navSections: SidebarSection[] = [
  {
    label: "Visão geral",
    items: [
      { label: "Resumo", icon: House, url: "/dashboard", permission: "acessar_dashboard" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { label: "Leads", icon: Users, url: "/leads", permission: "acessar_leads" },
      { label: "Conversas", icon: ChatCircleText, url: "/conversas", permission: "acessar_conversas" },
      { label: "Clientes", icon: Handshake, url: "/clientes", permission: "acessar_clientes" },
      { label: "Vendas", icon: CurrencyCircleDollar, url: "/vendas", permission: "acessar_vendas" },
      { label: "Cotações", icon: SlidersHorizontal, url: "/cotacao", permission: "acessar_cotacoes" },
      { label: "Tabelas de Vendas", icon: FileArrowDown, url: "/ferramentas-vendas/tabelas-personalizadas", permission: "acessar_ferramentas_vendas" },
    ],
  },
  {
    label: "Automação & IA",
    items: [
      { label: "Inteligência do Tenant", icon: BookOpen, url: "/inteligencia", permission: "acessar_qualificacao_ia" },
      { label: "Qualificação IA", icon: Target, url: "/qualificacao", permission: "acessar_qualificacao_ia" },
      { label: "Distribuição & Plantão", icon: Redistribute, url: "/leads/distribuicao", permission: "acessar_qualificacao_ia" },
      { label: "Automações & Regras", icon: Sparkle, url: "/automacoes", permission: "acessar_configuracoes" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { label: "Equipe da Unidade", icon: Users, url: "/equipe", permission: "convidar_corretor" },
      { label: "Metas & Desempenho", icon: Target, url: "/metas", permission: "gerenciar_metas" },
      { label: "Relatórios da Unidade", icon: ChartBar, url: "/relatorios", permission: "acessar_relatorios" },
      { label: "Financeiro & Comissões", icon: CurrencyCircleDollar, url: "/financeiro", permission: "acessar_financeiro" },
    ],
  },
  {
    label: "Operação",
    items: [
      { label: "Tarefas", icon: ClipboardText, url: "/tarefas", permission: "acessar_tarefas" },
      { label: "Documentos", icon: Note, url: "/documentos", permission: "acessar_documentos" },
      { label: "Catálogo de Produtos", icon: FolderSimple, url: "/catalogo", permission: "acessar_catalogo" },
      { label: "Materiais de Divulgação", icon: BookOpen, url: "/materiais-divulgacao", permission: "acessar_materiais_divulgacao" },
      { label: "NOC & Alertas", icon: Monitor, url: "/noc", permission: "ver_dashboard_equipe" },
    ],
  },
  {
    label: "Administração",
    items: [
      { label: "Marketing Meta", icon: Megaphone, url: "/marketing/campanhas", permission: "acessar_campanhas_meta" },
      { label: "Integrações", icon: Plug, url: "/integrations", permission: "acessar_integracao_meta" },
      { label: "Minha Unidade", icon: Buildings, url: "/filiais", permission: "acessar_configuracoes_unidade" },
      { label: "Parâmetros", icon: SlidersHorizontal, url: "/settings", permission: "acessar_configuracoes_pessoais" },
      { label: "Guia do Sistema", icon: BookOpen, url: "/guia", permission: "acessar_guia" },
    ],
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

const brokerHiddenPaths = ["/cotacao", "/automacoes"];

function canShowItem(item: SidebarItem, user: UserDisplayInfo | null, roleKey: UserDisplayInfo["roleKey"]) {
  if (!roleKey) return false;
  if (user?.jobTitle === "marketing" && marketingHiddenPaths.some((path) => item.url === path || item.url.startsWith(path + "/"))) {
    return false;
  }
  if (roleKey === "broker" && brokerHiddenPaths.some((path) => item.url === path || item.url.startsWith(path + "/"))) {
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
  const isPlantaoActive = pathname.startsWith("/leads/distribuicao/plantao");
  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canShowItem(item, user, roleKey)),
    }))
    .filter((section) => section.items.length > 0);

  // Cascata de entrada dos itens do menu: atraso progressivo conforme o item visível.
  const itemEntranceDelays = new Map<string, number>();
  {
    let index = 0;
    for (const section of visibleSections) {
      for (const item of section.items) {
        itemEntranceDelays.set(`${section.label}:${item.label}`, Math.min(index * 40, 520));
        index += 1;
      }
    }
  }

  async function handleLogout() {
    toast.info("Encerrando sua sessão...");
    try {
      await signOut();
      toast.success("Sessão encerrada.");
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 250);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sair agora.");
    }
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="space-y-3 border-b border-sidebar-border/50 p-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2 group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3">
        <Link href={user?.jobTitle === "marketing" ? "/marketing/campanhas" : "/dashboard"} className="flex h-8 min-w-0 items-center group-data-[collapsible=icon]:size-9 group-data-[collapsible=icon]:justify-center">
          <AncoraLogo src={logoUrl} className="h-8 w-full rounded-md object-contain object-left group-data-[collapsible=icon]:hidden" />
          <img src="/icon.png" alt="Ancora" className="hidden size-5 object-contain group-data-[collapsible=icon]:block" />
        </Link>

        {user?.isPlatformAdmin && (
          <SuperAdminRoleSwitcher activeOverride={user.activeRoleOverride} />
        )}

        {onDuty ? (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isPlantaoActive}
                render={<Link href="/leads/distribuicao/plantao" onClick={() => isMobile && setOpenMobile(false)} />}
                tooltip="Plantão ao vivo"
                className="group/plantao relative h-9 justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-[11px] font-semibold uppercase text-emerald-700 transition-[background-color,border-color,color] hover:border-emerald-500/40 hover:bg-emerald-500/15 dark:text-emerald-400 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:rounded-full group-data-[collapsible=icon]:border-emerald-500/25 group-data-[collapsible=icon]:bg-emerald-500/12 group-data-[collapsible=icon]:px-0 motion-reduce:transition-none"
              >
                <div className="flex min-w-0 items-center gap-2 group-data-[collapsible=icon]:hidden">
                  <span className="relative flex size-2 shrink-0">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                  </span>
                  <span className="truncate tracking-wide">Plantão ao vivo</span>
                </div>
                <WifiHigh className="size-4 shrink-0 text-emerald-500 transition-transform duration-[var(--duration-quick)] group-hover/plantao:scale-105 motion-reduce:transition-none" />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : null}
      </SidebarHeader>

      <SidebarContent className="pl-3 pr-1.5 py-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-2">
        <div className="flex flex-col gap-4 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-2">
          {visibleSections.map((section, sectionIndex) => (
            <div key={section.label} className="w-full group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
              {sectionIndex > 0 ? <div className="mb-3 h-px w-full bg-sidebar-border/55 group-data-[collapsible=icon]:mb-2 group-data-[collapsible=icon]:w-5" /> : null}
              <p className="mb-1.5 px-2 font-mono text-[10px] font-medium tracking-wider text-sidebar-foreground/50 group-data-[collapsible=icon]:sr-only">
                {section.label}
              </p>
              <SidebarMenu className="gap-1 group-data-[collapsible=icon]:items-center">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    pathname === item.url ||
                    (item.url !== "/dashboard" && pathname.startsWith(item.url + "/")) ||
                    (item.url.startsWith("/marketing") && pathname.startsWith("/marketing"));
                  const entranceDelay = itemEntranceDelays.get(`${section.label}:${item.label}`) ?? 0;

                  const itemTargetUrl = item.url === "/filiais" && user?.roleKey === "manager" && user?.branchId
                    ? `/unidades/${user.branchId}`
                    : item.url;

                  return (
                    <SidebarMenuItem
                      key={item.label}
                      className="ct-reveal relative group-data-[collapsible=icon]:w-full"
                      style={{ animationDelay: `${entranceDelay}ms` }}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active-item"
                          className="absolute inset-0 rounded-lg bg-primary/10 dark:bg-primary/15 border border-primary/20 pointer-events-none"
                          transition={{ type: "spring", stiffness: 450, damping: 35 }}
                        />
                      )}
                      <SidebarMenuButton
                        isActive={isActive}
                        render={<Link href={itemTargetUrl} onClick={() => isMobile && setOpenMobile(false)} />}
                        tooltip={item.label}
                        className="relative z-10 h-9 px-3 text-[13px] font-medium leading-none group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:px-0"
                      >
                        <Icon weight={isActive ? "fill" : "regular"} className="size-4 shrink-0 text-primary" />
                        <span className="truncate">{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </div>
          ))}
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 p-3 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:py-3 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:w-full">
            <SidebarMenuButton
              onClick={() => {
                const event = new CustomEvent("open-agent-drawer");
                window.dispatchEvent(event);
              }}
              tooltip="Agente IA (Ctrl+J)"
              className="w-full h-9 px-3 text-[13px] font-semibold bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors rounded-xl group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:px-0"
            >
              <Sparkle weight="fill" className="size-4 shrink-0 text-primary animate-pulse" />
              <span className="truncate">Agente IA</span>
              <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-primary/15 text-primary group-data-[collapsible=icon]:hidden">
                Ctrl+J
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem className="group-data-[collapsible=icon]:w-full">
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={userName} className="group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0!" />}>
                <UserAvatar seed={userName} name={userName} size="sm" className="size-7 shrink-0" />
                <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="truncate font-medium">{userName}</span>
                  <span className="truncate text-xs text-sidebar-foreground/55">{userRole}</span>
                </span>
                <SignOut className="ml-auto size-4 shrink-0 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[var(--sidebar-width)]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <UserAvatar seed={userName} name={userName} size="sm" className="size-8" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">{userName}</span>
                        <span className="text-xs text-muted-foreground">{userRole}</span>
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
                {roleKey && user?.permissions?.includes("acessar_configuracoes") ? (
                  <DropdownMenuItem render={<Link href="/settings" />}>
                    <SlidersHorizontal className="size-4" />
                    Configurações
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <SignOut className="size-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
