import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";

import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";

import { buildEssential } from "../diretor-dashboard-preview/_components/essential-example";

/**
 * Dev-only: o painel real da aba "Visão da operação" (DirectorLiteDashboard) com dados de exemplo, dentro do
 * mesmo canvas do app (arc-venancor + data-skin="diretor"), SEM a moldura da prévia. Serve para conferir o visual
 * real antes de publicar. Não existe em produção.
 */
const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
  { id: "branch-ni", name: "Niterói 1 - Luiz Leopoldo" },
  { id: "branch-cg1", name: "Campo Grande 1 - Coronel August" },
];

export default function DirectorDashboardRealPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const now = new Date();
  const data = buildEssential("today", "all", now);
  const skin = { "--director-brand-color": "#3b2dff", "--director-brand-foreground": "#ffffff" } as CSSProperties;
  return (
    <div className="arc-venancor" data-skin="diretor" style={skin}>
      <div className="app-shell-canvas h-app overflow-y-auto overflow-x-hidden overscroll-contain arc-venancor" data-slot="app-scroll-frame" data-skin="diretor" style={{ ...skin, background: "var(--background)" }}>
        <div className="mx-auto w-full max-w-[1328px] px-6 pb-28 pt-2">
          <DirectorLiteDashboard data={data} period="today" branchId={null} branches={BRANCHES} now={now} />
        </div>
      </div>
    </div>
  );
}
