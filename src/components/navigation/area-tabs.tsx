"use client";

import type { MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteRouteTabs } from "@/components/lite/page/route-tabs";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";
import { resolveNavLocation, visibleNavTabs } from "@/shared/navigation/nav-registry";

import { useNavFlags, useNavUser } from "./nav-access";

/**
 * Abas que são visões da mesma página (?tab=...) trocam só a URL, sem ida ao servidor:
 * a página lê a aba pela query e o que a pessoa digitou continua na tela.
 */
function switchViewInPlace(event: MouseEvent<HTMLElement>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return;
  const target = new URL(anchor.href, window.location.href);
  if (target.origin !== window.location.origin || target.pathname !== window.location.pathname) return;
  event.preventDefault();
  window.history.pushState(null, "", `${target.pathname}${target.search}`);
}

/**
 * Abas da área atual (cadastro em nav-registry). Some quando a área tem uma aba só para quem está vendo,
 * para não ocupar espaço à toa.
 */
export function AreaTabs() {
  const currentPathname = usePathname();
  const searchParams = useSearchParams();
  const directorLite = useArcScopeEnabled();
  const { negotiationsEnabled, initialUser, previewPathname } = useNavFlags();
  const user = useNavUser(initialUser);

  // Na prévia de desenvolvimento o endereço simulado (com a query) vem do shell.
  const location = previewPathname ? resolveNavLocation(previewPathname) : resolveNavLocation(currentPathname, searchParams);
  if (!location || !user) return null;
  const tabs = visibleNavTabs(location.area, { ...user, negotiationsEnabled });
  if (tabs.length < 2 || !tabs.some((tab) => tab.id === location.tab.id)) return null;

  const items = tabs.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }));
  const label = `Seções de ${location.area.label}`;
  if (directorLite) return <div data-slot="area-tabs" className="px-4 pt-2" onClickCapture={switchViewInPlace}><LiteRouteTabs label={label} tabs={items} active={location.tab.id} /></div>;
  return <div data-slot="area-tabs" className="bg-background px-5 lg:px-6" onClickCapture={switchViewInPlace}><RouteSectionTabs label={label} tabs={items} active={location.tab.id} /></div>;
}
