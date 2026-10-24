import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";

import { notFound } from "next/navigation";

import { DirectorLiteDashboard } from "@/features/dashboard/components/director-lite/director-lite-dashboard";
import { DirectorLiteQualificationFunnelPage } from "@/features/dashboard/components/director-lite/qualification-funnel-page";
import { parseFunnelPeriod } from "@/features/qualification-turbo/funnel";
import styles from "@/features/dashboard/components/director-lite/director-lite.module.css";

import { buildEssential } from "../diretor-dashboard-preview/_components/essential-example";
import { buildFunnel, type UnitId } from "../diretor-dashboard-preview/_components/data";

/**
 * Dev-only: as abas reais "Visão da operação" e "Funil de qualificação" com dados de exemplo, dentro do
 * mesmo canvas do app (arc-venancor + data-skin="diretor"), sem a moldura da prévia. `?tab=funnel` seleciona
 * o funil e aceita `period=7|30|90` e `unidade=`. Não existe em produção.
 */
const BRANCHES = [
  { id: "branch-centro", name: "Centro" },
  { id: "branch-barra", name: "Barra da Tijuca" },
  { id: "branch-ni", name: "Niterói 1 - Luiz Leopoldo" },
  { id: "branch-cg1", name: "Campo Grande 1 - Coronel August" },
];

const FUNNEL_UNIT_IDS: Record<string, UnitId> = {
  "branch-centro": "centro",
  "branch-barra": "barra",
  "branch-ni": "nova-iguacu",
  "branch-cg1": "centro",
};

type SearchParams = Record<string, string | string[] | undefined>;

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function DirectorDashboardRealPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const now = new Date();
  const activeTab = singleParam(params.tab);
  const rawBranchId = singleParam(params.unidade);
  const branch = BRANCHES.find((item) => item.id === rawBranchId) ?? null;

  if (activeTab === "funnel") {
    const period = parseFunnelPeriod(singleParam(params.period));
    const data = buildFunnel(period, branch ? FUNNEL_UNIT_IDS[branch.id] : "all", now);
    return (
      <div className="arc-venancor" data-skin="diretor">
        <div className="app-shell-canvas h-app overflow-y-auto overflow-x-hidden overscroll-contain arc-venancor" data-slot="app-scroll-frame" data-skin="diretor" style={{ background: "var(--background)" }}>
          <div className={styles.page}>
            <DirectorLiteQualificationFunnelPage data={data} branchId={branch?.id ?? null} branches={BRANCHES} firstName="Renata" now={now} />
          </div>
        </div>
      </div>
    );
  }

  const data = buildEssential("today", "all", now);
  return (
    <div className="arc-venancor" data-skin="diretor">
      <div className="app-shell-canvas h-app overflow-y-auto overflow-x-hidden overscroll-contain arc-venancor" data-slot="app-scroll-frame" data-skin="diretor" style={{ background: "var(--background)" }}>
        <div className={styles.page}>
          <DirectorLiteDashboard data={data} period="today" branchId={null} branches={BRANCHES} now={now} />
        </div>
      </div>
    </div>
  );
}
