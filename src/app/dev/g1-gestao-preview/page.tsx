"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { buildUnitOverview, type OverviewInput, type TeamMetricsInput } from "@/features/team-management-ui/build-overview";
import { UnitOverviewView } from "@/features/team-management-ui/unit-overview";

/** Dev-only preview of /gestao with fake data. /dev/g1-gestao-preview?metrics=0 mostra a variante sem indicadores. */
const identity: Omit<OverviewInput, "metrics"> = {
  activeBrokers: 14,
  supervisors: [
    { supervisorId: "sup-ana", name: "Ana Ribeiro", image: null, teamName: "Equipe Centro", brokers: 5 },
    { supervisorId: "sup-bruno", name: "Bruno Lima", image: null, teamName: "Equipe Norte", brokers: 4 },
    { supervisorId: "sup-carla", name: "Carla Mendes", image: null, teamName: null, brokers: 3 },
  ],
  unassigned: [
    { userId: "b-1", name: "Diego Souza" },
    { userId: "b-2", name: "Elisa Freitas" },
  ],
};

const metrics = new Map<string, TeamMetricsInput>([
  ["sup-ana", { score: 88, band: "excelente", sla: "9 min", acceptRate: "92%", conversion: "24%", trend: "up", strengths: ["Aceite rápido", "Primeiro contato no prazo"], concerns: ["Retornos vencidos"] }],
  ["sup-bruno", { score: 61, band: "atencao", sla: "18 min", acceptRate: "74%", conversion: "15%", trend: "down", strengths: ["Conversão acima da média"], concerns: ["Aceite lento", "Redistribuições altas"] }],
  ["sup-carla", { score: 38, band: "critico", sla: "34 min", acceptRate: "58%", conversion: "9%", trend: "down", strengths: [], concerns: ["Leads sem próxima ação", "Primeiro contato atrasado"] }],
]);

function Showcase() {
  const withMetrics = useSearchParams().get("metrics") !== "0";
  const overview = buildUnitOverview({ ...identity, metrics: withMetrics ? metrics : null });
  return <UnitOverviewView key={String(withMetrics)} overview={overview} />;
}

export default function G1GestaoPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Showcase /></Suspense>;
}
