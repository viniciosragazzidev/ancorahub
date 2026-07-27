import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";

export async function calculateGoalProgress(goalId: string): Promise<void> {
  const db = getDatabase();

  // Fetch the goal
  const [goal] = await db
    .select({
      id: schema.goals.id,
      tenantId: schema.goals.tenantId,
      scope: schema.goals.scope,
      scopeId: schema.goals.scopeId,
      targetType: schema.goals.targetType,
      targetValue: schema.goals.targetValue,
      startDate: schema.goals.startDate,
      endDate: schema.goals.endDate,
    })
    .from(schema.goals)
    .where(eq(schema.goals.id, goalId))
    .limit(1);

  if (!goal) return;

  const currentValue = await computeCurrentValue(goal);
  const targetVal = parseFloat(String(goal.targetValue)) || 1;
  const percentage = targetVal > 0 ? Math.round((currentValue / targetVal) * 100 * 100) / 100 : 0;

  // Upsert into goal_progress
  const existing = await db
    .select({ id: schema.goalProgress.id })
    .from(schema.goalProgress)
    .where(eq(schema.goalProgress.goalId, goalId))
    .limit(1);

  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  if (existing.length > 0) {
    await db
      .update(schema.goalProgress)
      .set({
        currentValue: String(currentValue),
        percentage: String(clampedPercentage),
        calculatedAt: new Date(),
      })
      .where(eq(schema.goalProgress.goalId, goalId));
  } else {
    await db.insert(schema.goalProgress).values({
      id: randomUUID(),
      goalId,
      currentValue: String(currentValue),
      percentage: String(clampedPercentage),
      calculatedAt: new Date(),
    });
  }
}

type GoalRow = {
  id: string;
  tenantId: string;
  scope: string;
  scopeId: string | null;
  targetType: string;
  targetValue: string;
  startDate: Date;
  endDate: Date;
};

async function computeCurrentValue(goal: GoalRow): Promise<number> {
  const db = getDatabase();

  switch (goal.targetType) {
    case "sales_count": {
      // Count sales for the scope/period
      const conditions = [
        eq(schema.sales.tenantId, goal.tenantId),
        eq(schema.sales.status, "active"),
        gte(schema.sales.saleDate, goal.startDate),
        lte(schema.sales.saleDate, goal.endDate),
      ];

      if (goal.scope === "broker" && goal.scopeId) {
        conditions.push(eq(schema.sales.brokerId, goal.scopeId));
      } else if (goal.scope === "branch" && goal.scopeId) {
        conditions.push(
          sql`${schema.sales.leadId} IN (
            SELECT ${schema.leads.id} FROM ${schema.leads}
            WHERE ${schema.leads.branchId} = ${goal.scopeId}
          )`,
        );
      } else if (goal.scope === "team") {
        // Team scope looks for a specific set of brokers
        // For MVP, this is simplified to the scopeId matching a specific query
        conditions.push(sql`1=1`); // TODO: implement team membership lookup
      }

      const [countResult] = await db
        .select({ value: sql<number>`COUNT(*)::int` })
        .from(schema.sales)
        .where(and(...conditions));

      return countResult?.value ?? 0;
    }

    case "revenue": {
      const conditions = [
        eq(schema.sales.tenantId, goal.tenantId),
        eq(schema.sales.status, "active"),
        gte(schema.sales.saleDate, goal.startDate),
        lte(schema.sales.saleDate, goal.endDate),
      ];

      if (goal.scope === "broker" && goal.scopeId) {
        conditions.push(eq(schema.sales.brokerId, goal.scopeId));
      } else if (goal.scope === "branch" && goal.scopeId) {
        conditions.push(
          sql`${schema.sales.leadId} IN (
            SELECT ${schema.leads.id} FROM ${schema.leads}
            WHERE ${schema.leads.branchId} = ${goal.scopeId}
          )`,
        );
      }

      const [revenueResult] = await db
        .select({ value: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)` })
        .from(schema.sales)
        .where(and(...conditions));

      return parseFloat(revenueResult?.value ?? "0");
    }

    case "leads_contacted": {
      const conditions = [
        eq(schema.leads.tenantId, goal.tenantId),
        sql`${schema.leads.firstContactAt} IS NOT NULL`,
        gte(schema.leads.firstContactAt, goal.startDate),
        lte(schema.leads.firstContactAt, goal.endDate),
      ];

      if (goal.scope === "broker" && goal.scopeId) {
        conditions.push(eq(schema.leads.corretorId, goal.scopeId));
      } else if (goal.scope === "branch" && goal.scopeId) {
        conditions.push(eq(schema.leads.branchId, goal.scopeId));
      }

      const [leadsResult] = await db
        .select({ value: sql<number>`COUNT(*)::int` })
        .from(schema.leads)
        .where(and(...conditions));

      return leadsResult?.value ?? 0;
    }

    case "conversion_rate": {
      // Conversion rate = leads converted / leads contacted
      const scopeCondition =
        goal.scope === "broker" && goal.scopeId
          ? eq(schema.leads.corretorId, goal.scopeId)
          : goal.scope === "branch" && goal.scopeId
            ? eq(schema.leads.branchId, goal.scopeId)
            : sql`1=1`;

      const [rateResult] = await db
        .select({
          converted: sql<number>`COUNT(*) FILTER (WHERE ${schema.leads.status} = 'converted')::int`,
          contacted: sql<number>`COUNT(*) FILTER (WHERE ${schema.leads.firstContactAt} IS NOT NULL)::int`,
        })
        .from(schema.leads)
        .where(
          and(
            eq(schema.leads.tenantId, goal.tenantId),
            gte(schema.leads.createdAt, goal.startDate),
            lte(schema.leads.createdAt, goal.endDate),
            scopeCondition,
          ),
        );

      const contacted = rateResult?.contacted ?? 0;
      if (contacted === 0) return 0;
      return Math.round((rateResult.converted / contacted) * 10000) / 100; // Return as percentage with 2 decimals
    }

    default:
      return 0;
  }
}
