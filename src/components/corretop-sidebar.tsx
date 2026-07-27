"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  SignOut,
  SlidersHorizontal,
  Target,
  Users,
  WifiHigh,
} from "@/components/huge-icons";
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
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { hasCapability, type PermissionKey } from "@/shared/auth/permissions";
import { signOut } from "@/shared/auth/client";
import { CorreTopLogo } from "@/components/corretop-logo";
import { UserAvatar } from "@/components/ui/user-avatar";

type SidebarItem = { label: string; icon: typeof House; url: string; permission: PermissionKey };

// Flat list of navigation items without section headers
const allNavItems: SidebarItem[] = [
  { label: "Resumo", icon: House, url: "/dashboard", permission: "acessar_dashboard" },
  { label: "Leads", icon: Users, url: "/leads", permission: "acessar_leads" },
  { label: "Clientes", icon: Handshake, url: "/clientes", permission: "acessar_clientes" },
  { label: "Unidades", icon: Buildings, url: "/filiais", permission: "gerenciar_filiais" },
  { label: "Equipe", icon: Users, url: "/equipe", permission: "convidar_corretor" },
  { label: "Metas", icon: Target, url: "/metas", permission: "gerenciar_metas" },
  { label: "Conversas", icon: ChatCircleText, url: "/conversas", permission: "acessar_conversas" },
  { label: "Tarefas", icon: ClipboardText, url: "/tarefas", permission: "acessar_tarefas" },
  { label: "Documentos", icon: Note, url: "/documentos", permission: "acessar_documentos" },
  { label: "NOC & Alertas", icon: Monitor, url: "/noc", permission: "ver_dashboard_equipe" },
  { label: "Vendas", icon: CurrencyCircleDollar, url: "/vendas", permission: "acessar_vendas" },
  { label: "Comissões", icon: CurrencyCircleDollar, url: "/configuracoes/comissoes", permission: "gerenciar_comissoes" },
  { label: "Relatórios", icon: ChartBar, url: "/relatorios", permission: "acessar_relatorios" },
  { label: "Importações Meta", icon: FileArrowDown, url: "/marketing/importacoes", permission: "ver_importacoes_meta" },
  { label: "Catálogo Global", icon: FolderSimple, url: "/catalogo", permission: "acessar_catalogo" },
  { label: "Materiais", icon: Megaphone, url: "/materiais-divulgacao", permission: "acessar_materiais_divulgacao" },
  { label: "Parâmetros", icon: SlidersHorizontal, url: "/settings", permission: "acessar_configuracoes_pessoais" },
  { label: "Guia do Sistema", icon: BookOpen, url: "/guia", permission: "acessar_guia" },
];

export function CorreTopSidebar({ logoUrl }: { logoUrl?: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [user, setUser] = useState<UserDisplayInfo | null>(null);

  useEffect(() => {
    getUserDisplayInfo().then(setUser);
  }, []);

  const userName = user?.name ?? "Usuário";
  const userRole = user?.role ?? "";
  const roleKey = user?.roleKey ?? null;

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

  const isPlantaoActive = pathname.startsWith("/leads/distribuicao/plantao");

  const visibleItems = roleKey
    ? allNavItems.filter((item) => {
        if (
          user?.jobTitle === "marketing" &&
          [
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
          ].some((path) => item.url === path || item.url.startsWith(path + "/"))
        ) {
          return false;
        }
        return hasCapability(roleKey, item.permission, user?.jobTitle ?? null);
      })
    : [];

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border/50 p-4 space-y-3">
        <Link href="/dashboard" prefetch className="block">
          <CorreTopLogo src={logoUrl} className="h-8 w-full rounded-md object-contain object-left group-data-[collapsible=icon]:hidden" />
          <img src="/icon.png" alt="CorreTop" className="h-7 w-7 mx-auto hidden group-data-[collapsible=icon]:block object-contain" />
        </Link>

        {/* Live Plantões Button Highlight */}
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={isPlantaoActive}
              render={<Link href="/leads/distribuicao/plantao" onClick={() => isMobile && setOpenMobile(false)} prefetch />}
              tooltip="Plantão ao vivo"
              className="group/plantao relative flex h-9 w-full items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:border-emerald-500/40 hover:bg-emerald-500/15 transition-all group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto"
            >
              <div className="flex items-center gap-2 group-data-[collapsible=icon]:hidden">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                <span className="font-bold tracking-tight">PLANTÃO Ao Vivo</span>
              </div>
              <WifiHigh className="size-4 text-emerald-500 group-hover/plantao:scale-110 transition-transform shrink-0" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="p-3.5">
        <SidebarMenu className="gap-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.url || (item.url !== "/dashboard" && pathname.startsWith(item.url + "/"));

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={<Link href={item.url} onClick={() => isMobile && setOpenMobile(false)} prefetch />}
                  tooltip={item.label}
                  className="px-3.5 py-2.5 h-9 text-xs font-medium"
                >
                  <Icon weight={isActive ? "fill" : "regular"} className="size-4 shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3.5">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger render={<SidebarMenuButton size="lg" tooltip={userName} />}>
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
                {roleKey && hasCapability(roleKey, "acessar_configuracoes", user?.jobTitle ?? null) ? (
                  <DropdownMenuItem render={<Link href="/settings" prefetch />}>
                    <SlidersHorizontal className="size-4" />Configurações
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleLogout}>
                  <SignOut className="size-4" />Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
