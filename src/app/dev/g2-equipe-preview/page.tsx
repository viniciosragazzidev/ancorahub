"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "@/features/team-management/metrics";
import { buildTeamPageView, type TeamGoalView } from "@/features/team-management-ui/team-page";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";

/** Dev-only preview of the team page with fake data. /dev/g2-equipe-preview?view=gestor|supervisor */
// Fixed clock: server and client must render the same text.
const NOW = new Date("2026-10-15T15:00:00.000Z");

function windowOf(overrides: Partial<TeamMetricWindow>): TeamMetricWindow {
  return {
    received: 24, accepted: 19, acceptanceRate: 79, medianAcceptanceSeconds: 70, redistributions: 3, slaRate: 88,
    activeLeads: 6, overdueReturns: 2, criticalOverdueReturns: 0, leadsWithoutNextAction: 1,
    quotes: 5, sales: 2, losses: 2, conversion: { received: 24, converted: 2, rate: 8.3 }, lastActivityAt: NOW,
    ...overrides,
  };
}

function brokerOf(id: string, name: string, current: Partial<TeamMetricWindow>, previous: Partial<TeamMetricWindow> = {}): TeamMetricBroker {
  return {
    id, name, image: null, supervisorId: "sup-ana", supervisorName: "Ana Ribeiro", teamName: "Equipe Centro", branchId: "branch-1",
    current: windowOf(current), previous: windowOf(previous), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0,
  };
}

const brokers: TeamMetricBroker[] = [
  brokerOf("b-carla", "Carla Mendes", { activeLeads: 11, leadsWithoutNextAction: 4, acceptanceRate: 60, lastActivityAt: NOW }, { conversion: { received: 20, converted: 1, rate: 5 } }),
  brokerOf("b-diego", "Diego Souza", { activeLeads: 5, acceptanceRate: 92, criticalOverdueReturns: 2, lastActivityAt: new Date("2026-10-08T15:00:00.000Z") }),
  brokerOf("b-elisa", "Elisa Freitas", { activeLeads: 4, acceptanceRate: 85, conversion: { received: 20, converted: 4, rate: 20 } }, { conversion: { received: 20, converted: 2, rate: 10 } }),
  brokerOf("b-fabio", "Fábio Nunes", { activeLeads: 1, acceptanceRate: 75 }),
];

const team: TeamMetricTeam = {
  id: "team-centro", name: "Equipe Centro", supervisorId: "sup-ana", supervisorName: "Ana Ribeiro", branchId: "branch-1",
  current: windowOf({ activeLeads: 21, overdueReturns: 4, criticalOverdueReturns: 3, leadsWithoutNextAction: 5 }),
  previous: windowOf({ slaRate: 80, acceptanceRate: 70, conversion: { received: 24, converted: 1, rate: 4 }, overdueReturns: 1 }),
  recent3DaysRedistributions: 4, previous3DaysRedistributions: 1,
  brokers,
};

const goal: TeamGoalView = { name: "Vendas da equipe em outubro", percentage: 62, currentValue: "18", targetValue: "29" };

function Showcase() {
  const view = useSearchParams().get("view") === "supervisor" ? "supervisor" : "gestor";
  // Mesma referência da unidade nas duas telas: o score é o mesmo para gestor e supervisor.
  const page = buildTeamPageView({
    team,
    unitConversionRate: 12,
    now: NOW,
    viewer: view === "gestor" ? "gestor" : "supervisor",
    goal,
    criticalLeads: new Map([["b-carla", { leadId: "lead-carla-1", leadName: "Mariana Costa" }], ["b-diego", { leadId: "lead-diego-3", leadName: "Roberto Dias" }]]),
  });
  return <TeamPageViewComponent key={view} view={page} />;
}

export default function G2EquipePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Showcase /></Suspense>;
}
