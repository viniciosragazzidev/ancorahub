"use client";

/**
 * Barra de topo do celular no Lite da gestão (27/11/2026). As telas 1:1 (painel, leads, distribuição, plantão) saíram da
 * faixa de topo do app; no celular ficavam sem o botão do menu e sem o voltar. Esta barra só aparece abaixo de 768px e
 * só quando a página não tem o próprio topo (`[data-slot="dashboard-header"]`) nem o próprio botão de menu
 * (`[data-mobile-nav]`): a regra fica em venancor-scope.css.
 */
import Link from "next/link";
import { ChevronLeft, Menu } from "lucide-react";

import { useArcScopeEnabled } from "@/components/arc/arc-scope-context";
import { resolveDirectorRoute } from "@/components/light/director-routes";
import { useDirectorRoute } from "@/components/light/use-director-route";
import { useOptionalSidebar } from "@/components/ui/sidebar";

export function LiteMobileBar() {
  const enabled = useArcScopeEnabled();
  const sidebar = useOptionalSidebar();
  const route = useDirectorRoute();
  if (!enabled || !sidebar) return null;
  const parentTitle = route.parentHref ? resolveDirectorRoute(route.parentHref).title : null;
  return (
    <nav className="lite-mobile-bar" aria-label="Navegação do celular">
      <button type="button" className="lite-mobile-bar-icon" aria-label="Abrir menu principal" onClick={() => sidebar.setOpenMobile(true)}>
        <Menu aria-hidden="true" />
      </button>
      {route.parentHref ? (
        <Link href={route.parentHref} className="lite-mobile-bar-back">
          <ChevronLeft aria-hidden="true" />
          <span>{parentTitle ?? "Voltar"}</span>
        </Link>
      ) : null}
    </nav>
  );
}
