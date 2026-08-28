"use client";

import {
  Bell,
  ChartLineUp,
  ChatCircleText,
  ClipboardText,
  Handshake,
  House,
  ListChecks,
  Note,
  Pause,
  SlidersHorizontal,
  SignOut,
  UserCircle,
} from "@/components/huge-icons";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { signOut } from "@/shared/auth/client";
import { toast } from "sonner";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { hasCapability, type PermissionKey } from "@/shared/auth/permissions";
import { getPendingFeedbackCountAction } from "@/features/leads/feedback-queries";
import { Badge } from "@/components/ui/badge";
import { ExperienceModeToggle } from "@/components/experience-mode-toggle";

type BrokerSidebarItem = { label: string; icon: typeof ListChecks; url: string; permission: PermissionKey; requiresFeature?: boolean };

const allBrokerItems: BrokerSidebarItem[] = [
  { label: "Conversas & WhatsApp", icon: ChatCircleText, url: "/conversas", permission: "acessar_conversas" },
  { label: "Meus Leads", icon: ListChecks, url: "/leads", permission: "acessar_leads" },
  { label: "Minha Fila", icon: ListChecks, url: "/minha-fila", permission: "acessar_leads" },
  { label: "Meu Perfil", icon: UserCircle, url: "/settings?tab=conta", permission: "acessar_configuracoes_pessoais" },
];

export function CorretorSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<UserDisplayInfo | null>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [pendingFeedback, setPendingFeedback] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getUserDisplayInfo().then(setUser);
    getPendingFeedbackCountAction().then((result) => {
      if (!cancelled) setPendingFeedback(result.count);
    });

    const interval = setInterval(() => {
      getPendingFeedbackCountAction().then((result) => {
        if (!cancelled) setPendingFeedback(result.count);
      });
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const userName = user?.name ?? "Luiza Costa";
  const initials = userName
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

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
      // signOut may fail if server is unreachable
    } finally {
      window.location.href = "/login";
    }
  }

  const role = user?.roleKey ?? null;
  const jobTitle = user?.jobTitle ?? null;

  const visibleItems = allBrokerItems.filter((item) => {
    if (item.requiresFeature && !user?.userProfileEnabled) {
      return false;
    }
    if (
      jobTitle === "marketing" &&
      ["/tarefas", "/documentos", "/clientes", "/vendas", "/checklist", "/minha-fila", "/corretor/resumo", "/minha-meta"].some(
        (path) => item.url === path || item.url.startsWith(path + "/")
      )
    ) {
      return false;
    }
    return hasCapability(role, item.permission, jobTitle);
  });

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader className="border-b border-sidebar-border/50 p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="h-9 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto" size="lg" render={<Link href="/corretor/resumo" prefetch={false} />}>
              <div className="grid size-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                C
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="pl-3 pr-1 py-2 group-data-[collapsible=icon]:px-0">
        <SidebarMenu className="gap-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const count = item.label === "Minha fila" ? pendingFeedback : 0;
            const isActive = pathname === item.url || pathname.startsWith(item.url + "/");

            return (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton
                  isActive={isActive}
                  render={<Link href={item.url} prefetch={false} />}
                  tooltip={item.label}
                  className="px-3 py-2 text-xs font-medium rounded-lg transition-colors group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto"
                >
                  <Icon weight={isActive ? "fill" : "regular"} className="size-4 shrink-0" />
                  <span className="flex-1 group-data-[collapsible=icon]:hidden truncate">{item.label}</span>
                  {count > 0 && (
                    <Badge
                      variant="warning"
                      className="ml-auto h-5 min-w-5 rounded-full px-1.5 text-[9px] font-bold leading-none group-data-[collapsible=icon]:hidden"
                    >
                      {count > 99 ? "99+" : count}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/50 p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<button type="button" onClick={handleLogout} />} tooltip={userName} className="group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto">
              <span className="grid size-7 place-items-center rounded-full bg-secondary text-foreground border border-border/80 text-xs font-semibold shrink-0">{initials}</span>
              <span className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate font-medium">{userName}</span>
                <span className="truncate text-xs text-sidebar-foreground/55">Corretor</span>
              </span>
              <SignOut className="ml-auto size-4 shrink-0 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden" />
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <div className="p-1">
              <ExperienceModeToggle variant="menu-item" />
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <SidebarMenuButton
              onClick={() => setIsAvailable((current) => !current)}
              tooltip={isAvailable ? "Pausar recebimento" : "Retomar recebimento"}
            >
              <Pause weight="fill" className="size-4 shrink-0" />
              <span>{isAvailable ? "Disponível para leads" : "Recebimento pausado"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
