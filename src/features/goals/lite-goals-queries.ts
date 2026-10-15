import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { getTeamMetrics } from "@/features/team-management/metrics";
import { saoPauloDayKey } from "@/features/team-management/health-input";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { isMetricGoalType, metricGoalProgress, windowForGoal } from "./metric-goals";
import type { LiteGoalType } from "./lite-goals-policy";

export type LiteGoalView = {
  id: string;
  scope: "team" | "broker";
  scopeId: string;
  name: string;
  targetType: string;
  targetValue: number;
  period: string;
  current: number;
  percentage: number;
};

export type TeamGoalsView = {
  period: string;
  team: LiteGoalView | null;
  brokers: Array<{ brokerId: string; name: string; goal: LiteGoalView | null }>;
};

/**
 * Metas do período atual de uma equipe: a da equipe e a de cada corretor.
 * Metas de cotações, SLA e tempo de resposta são recalculadas agora pelo G0 (cache de 60 s), não lidas do progresso guardado.
 * Quem chama já checou o acesso à equipe; aqui só se lê o que o viewer pode ver.
 */
export async function getTeamGoalsView(input: { context: TenantContext; supervisorId: string; now: Date }): Promise<TeamGoalsView> {
  const { context, supervisorId, now } = input;
  const period = saoPauloDayKey(now).slice(0, 7);
  const db = getDatabase();

  const brokerRows = await db.select({ userId: schema.tenantMemberships.userId, name: schema.user.name })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.user.id, schema.tenantMemberships.userId))
    .where(and(
      eq(schema.tenantMemberships.tenantId, context.tenantId),
      eq(schema.tenantMemberships.role, "broker"),
      eq(schema.tenantMemberships.status, "active"),
      eq(schema.tenantMemberships.supervisorId, supervisorId),
    ));
  const brokerIds = brokerRows.map((row) => row.userId);
  const scopeIds = [supervisorId, ...brokerIds];

  const goalRows = await db.select({
    id: schema.goals.id,
    scope: schema.goals.scope,
    scopeId: schema.goals.scopeId,
    name: schema.goals.name,
    targetType: schema.goals.targetType,
    targetValue: schema.goals.targetValue,
    period: schema.goals.period,
    currentValue: schema.goalProgress.currentValue,
    percentage: schema.goalProgress.percentage,
  })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goalProgress.goalId, schema.goals.id))
    .where(and(
      eq(schema.goals.tenantId, context.tenantId),
      eq(schema.goals.active, true),
      eq(schema.goals.period, period),
      inArray(schema.goals.scope, ["team", "broker"]),
      inArray(schema.goals.scopeId, scopeIds),
    ));

  const needsMetrics = goalRows.some((row) => isMetricGoalType(row.targetType));
  const metrics = needsMetrics ? await getTeamMetrics(context, { window: 30, now }) : null;

  const views: LiteGoalView[] = goalRows.flatMap((row) => {
    if (row.scopeId === null || (row.scope !== "team" && row.scope !== "broker")) return [];
    const targetValue = Number(row.targetValue);
    let current = Number(row.currentValue ?? 0);
    let percentage = Number(row.percentage ?? 0);
    if (metrics && isMetricGoalType(row.targetType)) {
      const progress = metricGoalProgress({ targetType: row.targetType, targetValue, window: windowForGoal({ scope: row.scope, scopeId: row.scopeId }, metrics) });
      current = progress.current;
      percentage = progress.percentage;
    }
    return [{
      id: row.id,
      scope: row.scope,
      scopeId: row.scopeId,
      name: row.name,
      targetType: row.targetType as LiteGoalType | string,
      targetValue,
      period: row.period,
      current,
      percentage: Math.round(Math.min(100, Math.max(0, percentage))),
    }];
  });

  return {
    period,
    team: views.find((view) => view.scope === "team" && view.scopeId === supervisorId) ?? null,
    brokers: brokerRows.map((broker) => ({
      brokerId: broker.userId,
      name: broker.name ?? "Corretor",
      goal: views.find((view) => view.scope === "broker" && view.scopeId === broker.userId) ?? null,
    })),
  };
}

/**
 * Meta do mês de um corretor (perfil do corretor). Como em getTeamGoalsView: metas de cotações, SLA e tempo
 * de resposta são recalculadas agora pelo G0 no escopo de quem vê. Quem chama já checou o acesso ao corretor.
 */
export async function getBrokerMonthGoal(input: { context: TenantContext; brokerId: string; now: Date }): Promise<{ period: string; goal: LiteGoalView | null }> {
  const { context, brokerId, now } = input;
  const period = saoPauloDayKey(now).slice(0, 7);
  const [row] = await getDatabase().select({
    id: schema.goals.id,
    name: schema.goals.name,
    targetType: schema.goals.targetType,
    targetValue: schema.goals.targetValue,
    currentValue: schema.goalProgress.currentValue,
    percentage: schema.goalProgress.percentage,
  })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goalProgress.goalId, schema.goals.id))
    .where(and(
      eq(schema.goals.tenantId, context.tenantId),
      eq(schema.goals.active, true),
      eq(schema.goals.period, period),
      eq(schema.goals.scope, "broker"),
      eq(schema.goals.scopeId, brokerId),
    ))
    .orderBy(desc(schema.goals.createdAt))
    .limit(1);
  if (!row) return { period, goal: null };

  const targetValue = Number(row.targetValue);
  let current = Number(row.currentValue ?? 0);
  let percentage = Number(row.percentage ?? 0);
  if (isMetricGoalType(row.targetType)) {
    const metrics = await getTeamMetrics(context, { window: 30, now });
    const progress = metricGoalProgress({ targetType: row.targetType, targetValue, window: windowForGoal({ scope: "broker", scopeId: brokerId }, metrics) });
    current = progress.current;
    percentage = progress.percentage;
  }
  return {
    period,
    goal: {
      id: row.id,
      scope: "broker",
      scopeId: brokerId,
      name: row.name,
      targetType: row.targetType,
      targetValue,
      period,
      current,
      percentage: Math.round(Math.min(100, Math.max(0, percentage))),
    },
  };
}
