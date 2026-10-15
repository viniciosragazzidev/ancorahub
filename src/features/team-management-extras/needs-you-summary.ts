import "server-only";

import { brokerTeamAlerts } from "@/features/team-management/alerts";
import { getTeamAlertContext } from "@/features/team-management/alert-context";
import { teamHealthScore } from "@/features/team-management/health";
import { teamHealthInputFor } from "@/features/team-management/health-input";
import { getTeamMetrics } from "@/features/team-management/metrics";
import { isTeamManagementEnabled } from "@/features/team-management-ui/flag";
import type { TenantContext } from "@/shared/auth/types";

import { brokersNeedPhrase, teamsNeedPhrase } from "./needs-you-phrase";

export type NeedsYouSummary = { count: number; phrase: string; href: "/gestao"; urgent: boolean };

/**
 * Card "Precisa de você" do Início (G4). Gestor: equipes em faixa Atenção ou Crítico (saúde do G0).
 * Supervisor: corretores da equipe com algum alerta de atenção ou crítico (alertas do G0).
 * Quem chama checa a flag feature_team_management_enabled.
 */
export async function getNeedsYouSummary(context: TenantContext, now = new Date()): Promise<NeedsYouSummary | null> {
  if (context.role !== "manager" && context.role !== "supervisor") return null;
  const metrics = await getTeamMetrics(context, { window: 7, now });

  if (context.role === "manager") {
    const count = metrics.teams.filter((team) => {
      const band = teamHealthScore(teamHealthInputFor(team, metrics.unitConversionRate, now)).band;
      return band === "Atenção" || band === "Crítico";
    }).length;
    return { count, phrase: teamsNeedPhrase(count), href: "/gestao", urgent: count > 0 };
  }

  const team = metrics.teams[0];
  if (!team) return { count: 0, phrase: brokersNeedPhrase(0), href: "/gestao", urgent: false };
  const average = team.brokers.length
    ? team.brokers.reduce((sum, broker) => sum + (broker.current.activeLeads ?? 0), 0) / team.brokers.length
    : 0;
  // Mesmo contexto da tela da equipe (plantão e lead crítico), para o número bater com o que o supervisor vê.
  const alertContext = await getTeamAlertContext(context, team.brokers.map((broker) => broker.id), now);
  const count = team.brokers.filter((broker) => brokerTeamAlerts({
    broker,
    now,
    windowDays: 7,
    onDuty: alertContext.onDuty.find((duty) => duty.id === broker.id) ?? null,
    teamAverageActiveLeads: average,
    criticalLead: alertContext.criticalLeads.get(broker.id) ?? null,
  }).some((alert) => alert.severity === "critical" || alert.severity === "warning")).length;
  return { count, phrase: brokersNeedPhrase(count), href: "/gestao", urgent: count > 0 };
}

/** Só com a flag ligada. Sem flag ou sem dado, o Início segue como antes. */
export async function loadNeedsYouIfEnabled(context: TenantContext): Promise<NeedsYouSummary | null> {
  if (!(await isTeamManagementEnabled())) return null;
  return getNeedsYouSummary(context).catch(() => null);
}
