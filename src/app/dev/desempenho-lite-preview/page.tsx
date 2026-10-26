import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import { LightBackButton } from "@/components/light/light-back-button";
import { BrokerPerformanceLite } from "@/features/broker-performance/components/broker-performance-lite";
import {
  buildBrokerPerformanceView,
  parseBrokerPerformancePeriod,
  type BrokerPerformanceData,
  type BrokerPerformanceSeriesPoint,
} from "@/features/broker-performance/domain";

/** Prévia só em desenvolvimento do Desempenho Lite com dados sintéticos. /dev/desempenho-lite-preview?periodo=hoje|7d|30d&cenario=vazio|sem-meta */

// Relógio fixo: servidor e cliente mostram o mesmo texto.
const TODAY = "2026-10-26";
const DAYS = ["2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", TODAY];

function series(period: BrokerPerformanceData["period"]): BrokerPerformanceSeriesPoint[] {
  // Hoje não tem série: o insight do melhor dia só vale em 7 e 30 dias.
  if (period === "hoje") return [];
  const length = period === "7d" ? 7 : 30;
  return Array.from({ length }, (_, index) => {
    const day = period === "7d" ? DAYS[index] : `2026-${index < 4 ? "09" : "10"}-${String(index < 4 ? 27 + index : index - 3).padStart(2, "0")}`;
    const weekday = (new Date(`${day}T12:00:00Z`).getUTCDay());
    const wave = [6, 9, 8, 12, 10, 4, 14][index % 7];
    return { key: day, weekday, leads: wave, quotes: Math.round(wave / 2), sales: weekday === 3 ? 3 : Math.round(wave / 6), revenue: (weekday === 3 ? 3 : Math.round(wave / 6)) * 520 };
  });
}

function fixture(period: BrokerPerformanceData["period"], scenario: string | undefined): BrokerPerformanceData {
  const scale = period === "hoje" ? 1 : period === "7d" ? 6 : 24;
  const empty = scenario === "vazio";
  return {
    period,
    today: TODAY,
    current: empty ? { leads: 0, quotes: 0, sales: 0, revenue: 0, slaRate: 0, slaLeads: 0 } : { leads: 10 * scale + 3, quotes: 5 * scale + 2, sales: 2 * scale, revenue: 1100 * scale, slaRate: 91, slaLeads: 10 * scale },
    previous: { leads: 9 * scale, quotes: 5 * scale + 2, sales: 2 * scale - 3, revenue: 1150 * scale, slaRate: 88, slaLeads: 9 * scale },
    series: empty ? series(period).map((point) => ({ ...point, leads: 0, quotes: 0, sales: 0, revenue: 0 })) : series(period),
    carriers: empty ? [] : [
      { name: "Amil", sales: Math.max(1, Math.round(scale * 0.8)), revenue: 520 * scale },
      { name: "SulAmérica", sales: Math.max(1, Math.round(scale * 0.7)), revenue: 410 * scale },
      { name: "Unimed", sales: Math.max(1, Math.round(scale * 0.5)), revenue: 170 * scale },
    ],
    goal: scenario === "sem-meta" ? null : { name: "Meta de outubro", targetType: "sales_count", targetValue: 12, current: empty ? 0 : 10, percentage: empty ? 0 : 83, endDay: "2026-10-31" },
  };
}

export default async function DesempenhoLitePreviewPage({ searchParams }: { searchParams: Promise<{ periodo?: string; cenario?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const view = buildBrokerPerformanceView(fixture(parseBrokerPerformancePeriod(params.periodo), params.cenario));
  // html e body não rolam (o shell Lite rola no próprio container); a prévia faz o mesmo.
  // A barra do topo reproduz a do LightAppHeader em /desempenho (isRoot false, volta para /dashboard).
  return (
    <div className="arc-venancor light-canvas flex h-dvh flex-col">
      <header className="z-30 shrink-0 bg-(--surface)/92 backdrop-blur-md">
        <div className="flex min-h-[60px] w-full items-center gap-2.5 px-3 py-2.5">
          <LightBackButton fallbackHref="/dashboard" className="size-10 border border-(--border)" />
          <p className="min-w-0 flex-1 truncate text-base font-medium tracking-tight text-(--foreground)">Desempenho</p>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="lite-page flex flex-col text-(--foreground)">
          <BrokerPerformanceLite view={view} />
        </main>
      </div>
    </div>
  );
}
