import "server-only";

import { and, desc, eq, gte, lt } from "drizzle-orm";

import { getTeamAlertContext } from "@/features/team-management/alert-context";
import { getTeamMetrics } from "@/features/team-management/metrics";
import { resolveTeamMetricsScope } from "@/features/team-management/scope";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { buildTeamPageView, type TeamGoalView, type TeamPageView, type TeamPageViewer } from "./team-page";
import { resolveTeamPageAccess, type TeamPageAccess } from "./team-page-access";

/** Meta da equipe em vigor (escopo team, scopeId = o supervisor). Mesma regra da visão do supervisor. */
export async function getTeamGoal(tenantId: string, supervisorId: string, now: Date): Promise<TeamGoalView | null> {
  const [row] = await getDatabase().select({
    name: schema.goals.name,
    targetValue: schema.goals.targetValue,
    currentValue: schema.goalProgress.currentValue,
    percentage: schema.goalProgress.percentage,
  })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goalProgress.goalId, schema.goals.id))
    .where(and(
      eq(schema.goals.tenantId, tenantId),
      eq(schema.goals.scope, "team"),
      eq(schema.goals.scopeId, supervisorId),
      eq(schema.goals.active, true),
      lt(schema.goals.startDate, now),
      gte(schema.goals.endDate, now),
    ))
    .orderBy(desc(schema.goals.endDate))
    .limit(1);
  if (!row) return null;
  return {
    name: row.name,
    percentage: Math.round(Number(row.percentage ?? 0)),
    currentValue: String(Number(row.currentValue ?? 0)),
    targetValue: String(Number(row.targetValue)),
  };
}

export type TeamPageLoad =
  | { access: Exclude<TeamPageAccess, "render">; view: null }
  | { access: "render"; view: TeamPageView };

/**
 * Carrega a página da equipe. O escopo é o do G0 (getTeamMetrics só devolve o que o viewer pode ver),
 * e ainda assim conferimos no servidor que a equipe é da unidade do gestor ou que é a do próprio supervisor.
 */
export async function loadTeamPage(input: {
  context: TenantContext;
  audience: "broker" | "supervisor" | "manager" | null;
  flagOn: boolean;
  requestedSupervisorId: string;
  now?: Date;
}): Promise<TeamPageLoad> {
  const { context, audience, flagOn, requestedSupervisorId } = input;
  const now = input.now ?? new Date();
  if (!flagOn) return { access: "off", view: null };
  const isManager = context.role === "manager" && audience === "manager";
  const isSupervisor = context.role === "supervisor" && audience === "supervisor";
  if (!isManager && !isSupervisor) return { access: "denied", view: null };
  if (isSupervisor && requestedSupervisorId !== context.userId) return { access: "notFound", view: null };

  const scope = resolveTeamMetricsScope(context);
  const metrics = await getTeamMetrics(context, { window: 7, now });
  const team = metrics.teams.find((item) => item.supervisorId === requestedSupervisorId) ?? null;
  const teamInViewerUnit = isManager
    ? team !== null && scope.kind === "unit" && team.branchId === scope.branchId
    : true;

  const access = resolveTeamPageAccess({
    flagOn,
    role: context.role,
    audience,
    requestedSupervisorId,
    viewerUserId: context.userId,
    teamFound: team !== null,
    teamInViewerUnit,
  });
  if (access !== "render" || !team) return { access: access === "render" ? "notFound" : access, view: null };

  const goal = await getTeamGoal(context.tenantId, requestedSupervisorId, now);
  const viewer: TeamPageViewer = isManager ? "gestor" : "supervisor";
  const alertContext = await getTeamAlertContext(context, team.brokers.map((broker) => broker.id), now);
  const view = buildTeamPageView({
    team,
    unitConversionRate: metrics.unitConversionRate,
    now,
    viewer,
    goal,
    onDuty: alertContext.onDuty,
    criticalLeads: alertContext.criticalLeads,
  });
  return { access: "render", view };
}
