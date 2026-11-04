"use client";

import { usePathname } from "next/navigation";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteRouteTabs } from "@/components/lite/page/route-tabs";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";
import { resolveNavLocation, visibleNavTabs } from "@/shared/navigation/nav-registry";

import { useNavFlags, useNavUser } from "./nav-access";

/**
 * Abas da área atual (cadastro em nav-registry). Some quando a área tem uma aba só para quem está vendo,
 * para não ocupar espaço à toa.
 */
export function AreaTabs() {
  const currentPathname = usePathname();
  const directorLite = useArcScopeEnabled();
  const { negotiationsEnabled, initialUser, previewPathname } = useNavFlags();
  const pathname = previewPathname ?? currentPathname;
  const user = useNavUser(initialUser);

  const location = resolveNavLocation(pathname);
  if (!location || !user) return null;
  const tabs = visibleNavTabs(location.area, { ...user, negotiationsEnabled });
  if (tabs.length < 2 || !tabs.some((tab) => tab.id === location.tab.id)) return null;

  const items = tabs.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }));
  const label = `Seções de ${location.area.label}`;
  if (directorLite) return <div data-slot="area-tabs" className="px-4 pt-2"><LiteRouteTabs label={label} tabs={items} active={location.tab.id} /></div>;
  return <div data-slot="area-tabs" className="bg-background px-5 lg:px-6"><RouteSectionTabs label={label} tabs={items} active={location.tab.id} /></div>;
}
