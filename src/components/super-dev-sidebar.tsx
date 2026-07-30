"use client";

import {
  House,
  Buildings,
  Monitor,
  ShieldCheck,
  SignOut,
  SlidersHorizontal,
  ShieldStar
} from "@/components/huge-icons";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "motion/react";

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

const superItems = [
  { label: "Visão geral", icon: House, url: "/super-dev" },
  { label: "Empresas", icon: Buildings, url: "/super-dev/tenants" },
  { label: "Auditoria & Logs", icon: Monitor, url: "/super-dev/audit" },
  { label: "Sessões Ativas", icon: ShieldStar, url: "/super-dev/sessions" },
  { label: "Configurações", icon: SlidersHorizontal, url: "/super-dev/settings" },
  { label: "Integridade", icon: ShieldCheck, url: "/super-dev/integridade" },
];

function NavigationGroup({
  label,
  items,
  groupIndex,
}: {
  label: string;
  items: typeof superItems;
  groupIndex: number;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.18,
        ease: [0, 0, 0.2, 1],
        delay: groupIndex * 0.06,
      }}
    >
      <SidebarCollapsibleGroup label={label}>
        <SidebarMenu>
          {items.map((item, index) => {
            const Icon = item.icon;
            const isActive = pathname === item.url || (item.url !== "/super-dev" && pathname.startsWith(item.url + "/"));
            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.15,
                  ease: [0, 0, 0.2, 1],
                  delay: groupIndex * 0.06 + index * 0.04,
                }}
              >
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={isActive}
                    render={<Link href={item.url} onClick={() => isMobile && setOpenMobile(false)} prefetch />}
                    tooltip={item.label}
                  >
                    <Icon weight={isActive ? "fill" : "regular"} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </motion.div>
            );
          })}
        </SidebarMenu>
      </SidebarCollapsibleGroup>
    </motion.div>
  );
}

export function SuperDevSidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const userName = session?.user?.name ?? "Super Admin";
  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    toast.info("Encerrando sua sessão...");
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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto" size="lg" render={<Link href="/super-dev" prefetch />}>
              <AncoraLogo className="h-7 w-full rounded-md object-contain object-left group-data-[collapsible=icon]:hidden" />
              <img src="/icon.png" alt="Ancora" className="h-7 w-7 mx-auto hidden group-data-[collapsible=icon]:block object-contain" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mx-2 rounded-md border border-sidebar-border bg-sidebar-warning/45 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <p className="text-[11px] text-sidebar-foreground/55">Ambiente</p>
          <p className="mt-0.5 truncate text-sm font-medium">Super Administração</p>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavigationGroup items={superItems} label="Plataforma" groupIndex={0} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger>
                <SidebarMenuButton size="lg" tooltip={userName}>
                  <UserAvatar seed={session?.user?.email || userName} name={userName} size="sm" className="size-7" />
                  <span className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{userName}</span>
                    <span className="truncate text-xs text-sidebar-foreground/55">Super Administrador</span>
                  </span>
                  <SignOut className="ml-auto size-4 shrink-0 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-[var(--sidebar-width)]">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>
                    <div className="flex items-center gap-2">
                      <UserAvatar seed={session?.user?.email || userName} name={userName} size="sm" className="size-8" />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium leading-none">{userName}</span>
                        <span className="text-xs text-muted-foreground">Super Administrador</span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem render={<Link href="/super-dev/settings" prefetch />}>
                  <SlidersHorizontal className="size-4" />Configurações
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
