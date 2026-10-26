import "@/components/arc/venancor-scope.css";
import "@/components/arc/director-skin.css";
import "@/components/arc/director-primitives.css";

import { notFound } from "next/navigation";

import type { OverviewPeriod } from "@/features/dashboard/overview-filter";

import { buildEssential } from "../diretor-dashboard-preview/_components/essential-example";
import { DirectorPerformance } from "./director-performance";

/**
 * Prévia só em desenvolvimento: o /dashboard do Diretor no estilo do Desempenho Lite, com os mesmos dados
 * de hoje (leads por fila, temperatura, requalificação, plantões e WhatsApp) e sem dados de venda.
 * Usa as fixtures do painel essencial. /dev/diretor-desempenho-preview?periodo=hoje|7d|30d
 */
const PERIOD: Record<string, OverviewPeriod> = { hoje: "today", "7d": "7d", "30d": "30d" };

export default async function DirectorPerformancePreviewPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const raw = (await searchParams).periodo;
  const period = raw && raw in PERIOD ? raw : "hoje";
  const data = buildEssential(PERIOD[period], "all", new Date("2026-10-26T15:00:00-03:00"));

  return (
    <div className="arc-venancor" data-skin="diretor">
      <div className="h-dvh overflow-y-auto overflow-x-hidden overscroll-contain" style={{ background: "var(--background)" }}>
        <main className="lite-page flex flex-col text-(--foreground)">
          <DirectorPerformance data={data} period={period} />
        </main>
      </div>
    </div>
  );
}
