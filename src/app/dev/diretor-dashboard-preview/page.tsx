import "@/components/arc/venancor-scope.css";

import { notFound } from "next/navigation";

import type { DrilldownId } from "@/features/reports/metrics/metrics-service";

import { DirectorDashboardPreview, type PreviewState, type Tab } from "./_components/dashboard-preview";

/**
 * Dev-only preview of the director dashboard in the Lite look, with example data (no database).
 * /dev/diretor-dashboard-preview?tab=overview|quality|funnel&estado=ready|loading|empty|error|off&vista=simples|detalhada&drill=out-of-sla
 */
const TABS: Tab[] = ["overview", "quality", "funnel"];
const STATES: PreviewState[] = ["ready", "loading", "empty", "error", "off"];
const DRILLS: DrilldownId[] = ["converted", "not-converted", "lost", "out-of-sla", "stale-negotiations", "high-intent-unassigned", "brokers-over-capacity"];

const pick = <T extends string>(value: string | string[] | undefined, list: readonly T[], fallback: T): T =>
  typeof value === "string" && (list as readonly string[]).includes(value) ? (value as T) : fallback;

export default async function DirectorDashboardPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  const drill = typeof params.drill === "string" && (DRILLS as string[]).includes(params.drill) ? (params.drill as DrilldownId) : null;
  return (
    <DirectorDashboardPreview
      initialTab={pick(params.tab, TABS, "overview")}
      initialState={pick(params.estado, STATES, "ready")}
      initialVista={pick(params.vista, ["simples", "detalhada"] as const, "simples")}
      initialDrill={drill}
    />
  );
}
