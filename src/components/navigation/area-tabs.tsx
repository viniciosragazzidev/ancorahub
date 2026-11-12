"use client";

import type { MouseEvent } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { LiteRouteTabs } from "@/components/lite/page/route-tabs";
import { RouteSectionTabs } from "@/components/ui/route-section-tabs";
import { resolveNavLocation, visibleNavTabs } from "@/shared/navigation/nav-registry";

import { useNavFlags, useNavUser } from "./nav-access";

/**
 * Abas marcadas como inPlace (visões que a página troca sozinha pela query) mudam só a URL, sem ida ao servidor:
 * o que a pessoa digitou continua na tela. As demais navegam normalmente.
 */
function switchViewInPlace(event: MouseEvent<HTMLElement>, inPlaceHrefs: ReadonlySet<string>) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor || !inPlaceHrefs.has(anchor.getAttribute("href") ?? "")) return;
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
  const { negotiationsEnabled, postSaleAuditEnabled, autoSaleEnabled, initialUser, previewPathname } = useNavFlags();
  const user = useNavUser(initialUser);

  // Na prévia de desenvolvimento o endereço simulado (com a query) vem do shell.
  const location = previewPathname ? resolveNavLocation(previewPathname) : resolveNavLocation(currentPathname, searchParams);
  if (!location || !user) return null;
  const tabs = visibleNavTabs(location.area, { ...user, negotiationsEnabled, postSaleAuditEnabled, autoSaleEnabled });
  if (tabs.length < 2 || !tabs.some((tab) => tab.id === location.tab.id)) return null;

  const items = tabs.map((tab) => ({ id: tab.id, label: tab.label, href: tab.href }));
  const inPlaceHrefs = new Set(tabs.filter((tab) => tab.inPlace).map((tab) => tab.href));
  const onClickCapture = (event: MouseEvent<HTMLElement>) => switchViewInPlace(event, inPlaceHrefs);
  const label = `Seções de ${location.area.label}`;
  if (directorLite) return <div data-slot="area-tabs" className="px-4 pt-2" onClickCapture={onClickCapture}><LiteRouteTabs label={label} tabs={items} active={location.tab.id} /></div>;
  return <div data-slot="area-tabs" className="bg-background px-5 lg:px-6" onClickCapture={onClickCapture}><RouteSectionTabs label={label} tabs={items} active={location.tab.id} /></div>;
}
