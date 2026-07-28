"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";

import { ArrowsDownUp, ChartBar, ChartLineUp, ClipboardText, CurrencyCircleDollar, FileArrowDown, Gear, PiggyBank, SignOut, Target, TrendDown, TrendUp } from "@/components/huge-icons";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { SidebarCollapsibleGroup } from "@/components/sidebar-collapsible-group";
import { getUserDisplayInfo, type UserDisplayInfo } from "@/shared/auth/actions";
import { hasCapability, type PermissionKey } from "@/shared/auth/permissions";
import { signOut } from "@/shared/auth/client";

type SidebarItem = { label: string; icon: typeof ChartLineUp; url: string; permission: PermissionKey };
const overviewItems: SidebarItem[] = [
  { label: "Dashboard Financeiro", icon: ChartLineUp, url: "/financeiro", permission: "acessar_financeiro" },
  { label: "Fluxo de Caixa", icon: CurrencyCircleDollar, url: "/financeiro/fluxo-caixa", permission: "ver_fluxo_caixa" },
  { label: "Extrato", icon: ClipboardText, url: "/financeiro/extrato", permission: "ver_comissao_propria" },
];
const commissionItems: SidebarItem[] = [
  { label: "Comissões", icon: TrendUp, url: "/financeiro/comissoes", permission: "ver_comissao_propria" },
  { label: "Repasses", icon: ArrowsDownUp, url: "/financeiro/repasses", permission: "ver_comissao_propria" },
  { label: "Taxas & Custos", icon: TrendDown, url: "/financeiro/taxas", permission: "ver_taxas_custos" },
];
const goalsItems: SidebarItem[] = [
  { label: "Metas Financeiras", icon: Target, url: "/financeiro/metas", permission: "ver_meta_propria" },
  { label: "Resultado por Corretor", icon: ChartBar, url: "/financeiro/resultado-corretor", permission: "ver_resultado_corretor" },
  { label: "Comissionamento", icon: PiggyBank, url: "/financeiro/comissionamento", permission: "gerenciar_comissoes" },
];
const reportsItems: SidebarItem[] = [
  { label: "Relatórios", icon: ChartBar, url: "/financeiro/relatorios", permission: "ver_relatorios_financeiros" },
  { label: "Exportar Dados", icon: FileArrowDown as typeof ChartLineUp, url: "/financeiro/exportar", permission: "exportar_relatorios" },
  { label: "Cronograma de Repasses", icon: Target, url: "/financeiro/cronograma", permission: "ver_cronograma_repasses" },
];
const settingsItems: SidebarItem[] = [{ label: "Configurações", icon: Gear, url: "/financeiro/configuracoes", permission: "gerenciar_financeiro" }];

function NavigationGroup({ label, items, roleKey, jobTitle, groupIndex }: { label: string; items: SidebarItem[]; roleKey: UserDisplayInfo["roleKey"]; jobTitle: UserDisplayInfo["jobTitle"]; groupIndex: number }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const visibleItems = roleKey ? items.filter((item) => hasCapability(roleKey, item.permission, jobTitle)) : [];
  if (visibleItems.length === 0) return null;
  return <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18, ease: [0, 0, 0.2, 1], delay: groupIndex * 0.06 }}><SidebarCollapsibleGroup label={label}><SidebarMenu>{visibleItems.map((item, index) => { const Icon = item.icon; const isActive = pathname === item.url || pathname.startsWith(item.url + "/"); return <motion.div key={item.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15, ease: [0, 0, 0.2, 1], delay: groupIndex * 0.06 + index * 0.04 }}><SidebarMenuItem><SidebarMenuButton isActive={isActive} render={<Link href={item.url} onClick={() => isMobile && setOpenMobile(false)} prefetch />} tooltip={item.label}><Icon weight={isActive ? "fill" : "regular"} /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem></motion.div>; })}</SidebarMenu></SidebarCollapsibleGroup></motion.div>;
}

export function CorreTopFinanceiroSidebar() {
  const router = useRouter();
  const [user, setUser] = useState<UserDisplayInfo | null>(null);
  useEffect(() => { getUserDisplayInfo().then(setUser); }, []);
  const userName = user?.name ?? "Usuário";
  const userRole = user?.role ?? "";
  const roleKey = user?.roleKey ?? null;
  const initials = userName.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();

  async function handleLogout() {
    toast.info("Encerrando sua sessão...");
    try { await signOut(); toast.success("Sessão encerrada."); window.setTimeout(() => { router.replace("/login"); router.refresh(); }, 250); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível sair agora."); }
  }

  return <Sidebar variant="sidebar"><SidebarHeader><SidebarMenu><SidebarMenuItem><SidebarMenuButton className="h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:mx-auto" size="lg" render={<Link href="/financeiro" prefetch />}><div className="grid size-7 place-items-center rounded-md bg-emerald-600 text-xs font-bold text-white">$</div><span className="truncate font-semibold tracking-tight">Financeiro</span></SidebarMenuButton></SidebarMenuItem></SidebarMenu><div className="mx-2 rounded-md border border-sidebar-border bg-sidebar-warning/45 px-3 py-2.5 group-data-[collapsible=icon]:hidden"><p className="text-[11px] text-sidebar-foreground/55">Área financeira</p><p className="mt-0.5 truncate text-sm font-medium">{userRole || "Gestão Financeira"}</p></div></SidebarHeader><SidebarContent><NavigationGroup items={overviewItems} label="Visão geral" roleKey={roleKey} jobTitle={user?.jobTitle ?? null} groupIndex={0} /><NavigationGroup items={commissionItems} label="Comissões" roleKey={roleKey} jobTitle={user?.jobTitle ?? null} groupIndex={1} /><NavigationGroup items={goalsItems} label="Metas" roleKey={roleKey} jobTitle={user?.jobTitle ?? null} groupIndex={2} /><NavigationGroup items={reportsItems} label="Relatórios" roleKey={roleKey} jobTitle={user?.jobTitle ?? null} groupIndex={3} /><NavigationGroup items={settingsItems} label="Configurações" roleKey={roleKey} jobTitle={user?.jobTitle ?? null} groupIndex={4} /></SidebarContent><SidebarFooter><SidebarMenu><SidebarMenuItem><SidebarMenuButton size="lg" render={<button type="button" onClick={handleLogout} />} tooltip={userName}><span className="grid size-7 place-items-center rounded-full bg-secondary text-foreground border border-border/80 text-xs font-semibold">{initials}</span><span className="grid flex-1 text-left text-sm leading-tight"><span className="truncate font-medium">{userName}</span><span className="truncate text-xs text-sidebar-foreground/55">{userRole}</span></span><SignOut className="ml-auto size-4 shrink-0 text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden" /></SidebarMenuButton></SidebarMenuItem></SidebarMenu></SidebarFooter></Sidebar>;
}
