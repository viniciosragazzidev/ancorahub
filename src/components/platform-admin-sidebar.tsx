"use client";

import { Buildings, Gear, House, RoadHorizon, ShieldStar, SignOut, Clock, ShieldWarning, RocketLaunch, FileText, Megaphone, LockKey, ChatCircleText, ChartLineUp, WhatsappLogo, SlidersHorizontal } from "@/components/huge-icons";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarCollapsibleGroup } from "@/components/sidebar-collapsible-group";
import { useSession, signOut } from "@/shared/auth/client";
import { toast } from "sonner";
import { AncoraLogo } from "@/components/ancora-logo";
import { UserAvatar } from "@/components/ui/user-avatar";

export function PlatformAdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Super Admin";
  const userInitial = userName.charAt(0).toUpperCase();

  async function handleLogout() {
    toast.info("Encerrando sessão administrativa...");
    try {
      await signOut();
      toast.success("Sessão encerrada.");
      window.setTimeout(() => {
        router.replace("/admin/login");
        router.refresh();
      }, 250);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível sair agora.");
    }
  }

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border/50 py-3.5 pl-5 pr-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-10 hover:bg-transparent active:bg-transparent" size="lg">
              <UserAvatar seed={session?.user?.email || userName} name={userName} size="sm" className="size-8" />
              <div className="flex flex-col text-left group-data-[collapsible=icon]:hidden">
                <span className="font-semibold tracking-tight text-sm text-foreground">Super Admin</span>
                <AncoraLogo className="h-4 w-24 object-contain object-left" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-3 pt-4">
        <SidebarCollapsibleGroup label="Painel Geral" headerClassName="px-3.5 text-[10px] font-bold uppercase tracking-wider">
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/integrations/whatsapp"}
                render={<Link href="/super-admin/integrations/whatsapp" prefetch />}
                tooltip="WhatsApp Oficial"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <WhatsappLogo className="size-4" />
                <span>WhatsApp Oficial</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/whatsapp-review"}
                render={<Link href="/super-admin/whatsapp-review" prefetch />}
                tooltip="Revisão WhatsApp Meta"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <WhatsappLogo className="size-4" />
                <span>Revisão WhatsApp Meta</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/catalogo"}
                render={<Link href="/super-admin/catalogo" prefetch />}
                tooltip="Catálogo global"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <FileText className="size-4" />
                <span>Catálogo global</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/onboarding"}
                render={<Link href="/super-admin/onboarding" prefetch />}
                tooltip="Onboarding guiado"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <RocketLaunch className="size-4" />
                <span>Onboarding guiado</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin"}
                render={<Link href="/super-admin" prefetch />}
                tooltip="Visão Geral"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <House className="size-4" />
                <span>Visão Geral & DevTools</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/tenants" || pathname.startsWith("/super-admin/tenants/")}
                render={<Link href="/super-admin/tenants" prefetch />}
                tooltip="Empresas"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <Buildings className="size-4" />
                <span>Empresas (Tenants)</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/materiais-divulgacao"}
                render={<Link href="/super-admin/materiais-divulgacao" prefetch />}
                tooltip="Materiais de Divulgação"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <Megaphone className="size-4" />
                <span>Materiais de Divulgação</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarCollapsibleGroup>

        <SidebarCollapsibleGroup label="Segurança & Monitoramento" headerClassName="px-3.5 text-[10px] font-bold uppercase tracking-wider" className="mt-4">
          <SidebarMenu className="gap-1">
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/audit"}
                render={<Link href="/super-admin/audit" prefetch />}
                tooltip="Logs de Auditoria"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <ShieldWarning className="size-4" />
                <span>Logs de Auditoria</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/sessions"}
                render={<Link href="/super-admin/sessions" prefetch />}
                tooltip="Sessões Ativas"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <Clock className="size-4" />
                <span>Sessões Ativas</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === "/super-admin/settings"}
                render={<Link href="/super-admin/settings" prefetch />}
                tooltip="Configurações"
                className="px-3.5 py-2 text-xs font-medium"
              >
                <Gear className="size-4" />
                <span>Parâmetros do Servidor</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarCollapsibleGroup>

        <SidebarCollapsibleGroup label="Em preparação" headerClassName="px-3.5 text-[10px] font-bold uppercase tracking-wider" className="mt-4">
          <SidebarMenu className="gap-1">
            <LockedPreviewItem icon={ChatCircleText} label="Chat interno" />
            <LockedPreviewItem icon={ChartLineUp} label="Renovações" />
            <LockedPreviewItem icon={ShieldWarning} label="Integridade e conexões" />
            <LockedPreviewItem icon={RoadHorizon} label="Roadmap de desenvolvimento" />
          </SidebarMenu>
        </SidebarCollapsibleGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <SidebarMenuButton
                  size="lg"
                  tooltip={userName}
                  className="w-full justify-start rounded-lg hover:bg-sidebar-warning px-3 py-2"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-sidebar-warning/50 text-foreground/80">
                    <ShieldStar weight="fill" className="size-3.5" />
                  </span>
                  <div className="flex flex-col text-left flex-1 pl-2">
                    <span className="truncate text-xs font-medium text-foreground">{userName}</span>
                    <span className="truncate text-[10px] text-muted-foreground">Equipe Âncora Corretora</span>
                  </div>
                  <SignOut className="ml-auto size-4 shrink-0 text-muted-foreground/60 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[var(--sidebar-width)]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <UserAvatar seed={session?.user?.email || userName} name={userName} size="sm" className="size-8" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">{userName}</span>
                        <span className="text-xs text-muted-foreground">Super Admin</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/super-admin/settings" prefetch />}>
                  <SlidersHorizontal className="size-4" />Parâmetros
                </DropdownMenuItem>
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

function LockedPreviewItem({
  icon: Icon,
  label,
}: {
  icon: typeof LockKey;
  label: string;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-disabled="true"
        className="cursor-not-allowed px-3.5 py-2 text-xs font-medium opacity-50 hover:bg-transparent"
        tooltip={`${label}: em preparação`}
      >
        <Icon className="size-4" />
        <span className="flex-1">{label}</span>
        <LockKey aria-hidden="true" className="size-3.5" />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
