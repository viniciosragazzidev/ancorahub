import "server-only";

import { brokerInsights, pickInsights, teamInsights, type Insight } from "@/features/team-management/insights";
import { getTeamMetrics } from "@/features/team-management/metrics";
import type { TenantContext } from "@/shared/auth/types";

/** Até três destaques da equipe (G4), a partir da janela de 7 dias do G0. Quem chama checou o acesso à equipe. */
export async function getTeamInsights(input: { context: TenantContext; supervisorId: string; now: Date }): Promise<Insight[]> {
  const metrics = await getTeamMetrics(input.context, { window: 7, now: input.now });
  const team = metrics.teams.find((item) => item.supervisorId === input.supervisorId);
  if (!team) return [];
  const all = [
    ...teamInsights({ team, windowDays: 7 }),
    ...team.brokers.flatMap((broker) => brokerInsights({ broker, brokers: team.brokers })),
  ];
  return pickInsights(all);
}
