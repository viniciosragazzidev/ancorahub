"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { buildUnitOverview, type OverviewInput, type TeamMetricsInput, type TeamMetricsOverviewInput } from "@/features/team-management-ui/build-overview";
import type { TeamMetricBroker, TeamMetricWindow } from "@/features/team-management/metrics";
import { UnitOverviewView } from "@/features/team-management-ui/unit-overview";

/** Dev-only preview of /gestao with fake data. /dev/g1-gestao-preview?metrics=0 mostra a variante sem indicadores. */
const now = new Date("2026-10-15T15:00:00-03:00");

const identity: Omit<OverviewInput, "metrics" | "now"> = {
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

function metricWindow(overrides: Partial<TeamMetricWindow> = {}): TeamMetricWindow {
  return {
    received: 0,
    accepted: 0,
    acceptanceRate: 0,
    medianAcceptanceSeconds: null,
    redistributions: 0,
    slaRate: 0,
    activeLeads: null,
    overdueReturns: null,
    criticalOverdueReturns: null,
    leadsWithoutNextAction: null,
    quotes: 0,
    sales: 0,
    losses: 0,
    conversion: { received: 0, converted: 0, rate: 0 },
    lastActivityAt: null,
    ...overrides,
  };
}

function broker(id: string, lastActivityAt: Date, activeLeads: number): TeamMetricBroker {
  const current = metricWindow({ activeLeads, lastActivityAt });
  return {
    id,
    name: `Corretor ${id}`,
    image: null,
    supervisorId: id.startsWith("unassigned") ? null : id.split("-")[0] === "ana" ? "sup-ana" : id.split("-")[0] === "bruno" ? "sup-bruno" : "sup-carla",
    supervisorName: null,
    teamName: "Equipe",
    branchId: "unit-central",
    current,
    previous: metricWindow(),
    recent3DaysRedistributions: 0,
    previous3DaysRedistributions: 0,
  };
}

function teamMetric(input: {
  current: Partial<TeamMetricWindow>;
  previous?: Partial<TeamMetricWindow>;
  brokerPrefix: string;
  brokerCount: number;
}): TeamMetricsInput {
  const supervisorId = input.brokerPrefix === "unassigned" ? null : `sup-${input.brokerPrefix}`;
  return {
    id: supervisorId ?? "__no_team__",
    name: supervisorId ? `Equipe ${input.brokerPrefix}` : "Sem equipe",
    supervisorId,
    supervisorName: supervisorId ? input.brokerPrefix : null,
    branchId: "unit-central",
    current: metricWindow(input.current),
    previous: metricWindow(input.previous),
    recent3DaysRedistributions: 0,
    previous3DaysRedistributions: 0,
    brokers: Array.from({ length: input.brokerCount }, (_, index) => broker(`${input.brokerPrefix}-${index + 1}`, now, index + 1)),
  };
}

const metrics: TeamMetricsOverviewInput = {
  unit: {
    id: "unit-central",
    name: "Central",
    current: metricWindow({ received: 94, acceptanceRate: 84, slaRate: 87, conversion: { received: 78, converted: 18, rate: 23.1 } }),
    previous: metricWindow({ received: 79, acceptanceRate: 80, slaRate: 78, conversion: { received: 69, converted: 12, rate: 17.4 } }),
  },
  unitConversionRate: 23.1,
  teamsBySupervisorId: new Map([
    ["sup-ana", teamMetric({
      current: { received: 35, accepted: 32, acceptanceRate: 92, medianAcceptanceSeconds: 65, slaRate: 94, activeLeads: 15, overdueReturns: 1, leadsWithoutNextAction: 0, conversion: { received: 24, converted: 7, rate: 29.2 } },
      previous: { received: 28, accepted: 23, acceptanceRate: 82, medianAcceptanceSeconds: 88, slaRate: 80, conversion: { received: 20, converted: 4, rate: 20 } },
      brokerPrefix: "ana",
      brokerCount: 5,
    })],
    ["sup-bruno", teamMetric({
      current: { received: 28, accepted: 21, acceptanceRate: 75, medianAcceptanceSeconds: 240, redistributions: 8, slaRate: 68, activeLeads: 14, overdueReturns: 4, leadsWithoutNextAction: 2, conversion: { received: 21, converted: 3, rate: 14.3 } },
      previous: { received: 25, accepted: 20, acceptanceRate: 80, medianAcceptanceSeconds: 150, redistributions: 4, slaRate: 77, conversion: { received: 19, converted: 4, rate: 21.1 } },
      brokerPrefix: "bruno",
      brokerCount: 4,
    })],
    ["sup-carla", teamMetric({
      current: { received: 17, accepted: 10, acceptanceRate: 59, medianAcceptanceSeconds: 600, redistributions: 8, slaRate: 52, activeLeads: 12, overdueReturns: 5, leadsWithoutNextAction: 5, conversion: { received: 14, converted: 1, rate: 7.1 } },
      previous: { received: 13, accepted: 8, acceptanceRate: 62, medianAcceptanceSeconds: 410, redistributions: 4, slaRate: 61, conversion: { received: 11, converted: 2, rate: 18.2 } },
      brokerPrefix: "carla",
      brokerCount: 3,
    })],
  ]),
  unassignedTeam: teamMetric({
    current: { received: 14, accepted: 9, acceptanceRate: 64, medianAcceptanceSeconds: 180, slaRate: 70, activeLeads: 6, overdueReturns: 2, leadsWithoutNextAction: 1 },
    previous: { received: 13, accepted: 9, acceptanceRate: 69, medianAcceptanceSeconds: 150, slaRate: 73 },
    brokerPrefix: "unassigned",
    brokerCount: 2,
  }),
};

function Showcase() {
  const withMetrics = useSearchParams().get("metrics") !== "0";
  const overview = buildUnitOverview({ ...identity, now, metrics: withMetrics ? metrics : null });
  return <UnitOverviewView key={String(withMetrics)} overview={overview} />;
}

export default function G1GestaoPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Showcase /></Suspense>;
}
