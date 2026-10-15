"use client";

import "@/components/arc/venancor-scope.css";

import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import type { TeamGoalsView } from "@/features/goals/lite-goals-queries";
import type { TeamMetricBroker, TeamMetricTeam, TeamMetricWindow } from "@/features/team-management/metrics";
import { brokerInsights, pickInsights, teamInsights } from "@/features/team-management/insights";
import { buildTeamPageView } from "@/features/team-management-ui/team-page";
import { TeamPageViewComponent } from "@/features/team-management-ui/team-page-view";
import { GoalsSection } from "@/features/team-management-extras/goals-section";
import { InsightsSection } from "@/features/team-management-extras/insights-section";
import { brokersNeedPhrase, teamsNeedPhrase } from "@/features/team-management-extras/needs-you-phrase";

/** Dev-only preview of G4 and G5 with fake data. /dev/g45-preview?view=gestor|supervisor */
// Fixed clock: server and client must render the same text.
const NOW = new Date("2026-10-15T15:00:00.000Z");

function windowOf(overrides: Partial<TeamMetricWindow>): TeamMetricWindow {
  return {
    received: 20, accepted: 16, acceptanceRate: 80, medianAcceptanceSeconds: 420, redistributions: 1, slaRate: 90,
    activeLeads: 5, overdueReturns: 1, criticalOverdueReturns: 0, leadsWithoutNextAction: 0,
    quotes: 4, sales: 1, losses: 1, conversion: { received: 20, converted: 2, rate: 10 }, lastActivityAt: NOW,
    ...overrides,
  };
}

function brokerOf(id: string, name: string, current: Partial<TeamMetricWindow>, previous: Partial<TeamMetricWindow> = {}): TeamMetricBroker {
  return { id, name, image: null, supervisorId: "sup-ana", supervisorName: "Ana Ribeiro", teamName: "Equipe Centro", branchId: "branch-1", current: windowOf(current), previous: windowOf(previous), recent3DaysRedistributions: 0, previous3DaysRedistributions: 0 };
}

const brokers: TeamMetricBroker[] = [
  brokerOf("b-maria", "Maria Souza", { medianAcceptanceSeconds: 290, quotes: 6 }, { medianAcceptanceSeconds: 430 }),
  brokerOf("b-bruno", "Bruno Lima", { criticalOverdueReturns: 2, activeLeads: 7, lastActivityAt: NOW }),
  brokerOf("b-carlos", "Carlos Mota", { redistributions: 6, medianAcceptanceSeconds: 500 }),
  brokerOf("b-fabio", "Fábio Nunes", { activeLeads: 1, lastActivityAt: new Date("2026-10-08T15:00:00.000Z") }),
];

const team: TeamMetricTeam = {
  id: "team-centro", name: "Equipe Centro", supervisorId: "sup-ana", supervisorName: "Ana Ribeiro", branchId: "branch-1",
  current: windowOf({ received: 24, redistributions: 8, criticalOverdueReturns: 0 }),
  previous: windowOf({ received: 18, slaRate: 80 }),
  recent3DaysRedistributions: 4, previous3DaysRedistributions: 1,
  brokers,
};

const criticalLeads = new Map([["b-bruno", { leadId: "lead-bruno-2", leadName: "Mariana Costa" }]]);

const goals: TeamGoalsView = {
  period: "2026-10",
  team: { id: "g-team", scope: "team", scopeId: "sup-ana", name: "Cotações da equipe", targetType: "quotes_count", targetValue: 20, period: "2026-10", current: 14, percentage: 70 },
  brokers: [
    { brokerId: "b-maria", name: "Maria Souza", goal: { id: "g-m", scope: "broker", scopeId: "b-maria", name: "Cotações", targetType: "quotes_count", targetValue: 8, period: "2026-10", current: 6, percentage: 75 } },
    { brokerId: "b-bruno", name: "Bruno Lima", goal: null },
  ],
};

const insights = pickInsights([
  ...teamInsights({ team, windowDays: 7 }),
  ...brokers.flatMap((broker) => brokerInsights({ broker, brokers })),
]);

function Showcase() {
  const view = useSearchParams().get("view") === "supervisor" ? "supervisor" : "gestor";
  const page = buildTeamPageView({ team, unitConversionRate: 12, now: NOW, viewer: view === "gestor" ? "gestor" : "supervisor", goal: null, criticalLeads });
  return (
    <div key={view}>
      <TeamPageViewComponent view={page} />
      <div className="arc-venancor" style={{ maxWidth: 1080, margin: "0 auto", padding: "0 16px 40px", display: "grid", gap: 16 }}>
        <InsightsSection insights={insights} />
        <GoalsSection supervisorId="sup-ana" view={goals} canEditTeam canEditBrokers={view === "supervisor"} />
        <p style={{ margin: 0, color: "#6b6b6b", fontSize: 13 }}>No Início, a pílula de próxima ação mostra: gestor, {teamsNeedPhrase(2)}; supervisor, {brokersNeedPhrase(3)}.</p>
      </div>
    </div>
  );
}

export default function G45PreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <Suspense><Showcase /></Suspense>;
}
