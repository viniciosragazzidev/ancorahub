import "server-only";

import { and, desc, eq, or, sql, type SQL } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

export type GoalRecord = {
  id: string;
  tenantId: string;
  scope: "broker" | "team" | "branch" | "tenant";
  scopeId: string | null;
  scopeName: string | null;
  name: string;
  targetType: "sales_count" | "revenue" | "conversion_rate" | "leads_contacted";
  targetValue: string;
  period: string;
  startDate: Date;
  endDate: Date;
  active: boolean;
  createdBy: string;
  createdByName: string | null;
  createdAt: Date;
  updatedAt: Date;
  progressCurrentValue: string | null;
  progressPercentage: string | null;
  progressCalculatedAt: Date | null;
};

export type TeamMemberOption = {
  id: string;
  name: string;
  branchId: string | null;
  branchName: string | null;
};

const goalProgressColumns = {
  id: schema.goals.id,
  tenantId: schema.goals.tenantId,
  scope: schema.goals.scope,
  scopeId: schema.goals.scopeId,
  scopeName: sql<string | null>`CASE
    WHEN ${schema.goals.scope} = 'broker' THEN ${schema.user.name}
    WHEN ${schema.goals.scope} = 'branch' THEN ${schema.branches.name}
    WHEN ${schema.goals.scope} = 'tenant' THEN ${schema.tenants.name}
    ELSE ${schema.goals.scopeId}
  END`,
  name: schema.goals.name,
  targetType: schema.goals.targetType,
  targetValue: schema.goals.targetValue,
  period: schema.goals.period,
  startDate: schema.goals.startDate,
  endDate: schema.goals.endDate,
  active: schema.goals.active,
  createdBy: schema.goals.createdBy,
  createdByName: schema.user.name,
  createdAt: schema.goals.createdAt,
  updatedAt: schema.goals.updatedAt,
  progressCurrentValue: schema.goalProgress.currentValue,
  progressPercentage: schema.goalProgress.percentage,
  progressCalculatedAt: schema.goalProgress.calculatedAt,
};

export async function getGoals(): Promise<GoalRecord[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions: SQL<unknown>[] = [eq(schema.goals.tenantId, context.tenantId)];

  // Role-based scope filtering
  if (context.role === "broker") {
    const brokerCondition = and(
      eq(schema.goals.scope, "broker"),
      eq(schema.goals.scopeId, context.userId),
    );
    if (brokerCondition) conditions.push(brokerCondition);
  } else if (context.role === "manager" && context.branchId) {
    const branchId: string = context.branchId;
    const managerCondition = or(
      and(eq(schema.goals.scope, "branch"), eq(schema.goals.scopeId, branchId)),
      eq(schema.goals.scope, "tenant"),
      sql`(
        ${schema.goals.scope} = 'broker' AND ${schema.goals.scopeId} IN (
          SELECT ${schema.tenantMemberships.userId}
          FROM ${schema.tenantMemberships}
          WHERE ${schema.tenantMemberships.tenantId} = ${context.tenantId}
            AND ${schema.tenantMemberships.branchId} = ${branchId}
        )
      )`,
      eq(schema.goals.scope, "team"),
    );
    if (managerCondition) conditions.push(managerCondition);
  }

  return db
    .select(goalProgressColumns)
    .from(schema.goals)
    .leftJoin(schema.user, eq(schema.goals.createdBy, schema.user.id))
    .leftJoin(schema.branches, eq(schema.goals.scopeId, schema.branches.id))
    .leftJoin(schema.tenants, eq(schema.goals.tenantId, schema.tenants.id))
    .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
    .where(and(...conditions))
    .orderBy(desc(schema.goals.createdAt));
}

export async function getGoalById(goalId: string): Promise<GoalRecord | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const [row] = await db
    .select(goalProgressColumns)
    .from(schema.goals)
    .leftJoin(schema.user, eq(schema.goals.createdBy, schema.user.id))
    .leftJoin(schema.branches, eq(schema.goals.scopeId, schema.branches.id))
    .leftJoin(schema.tenants, eq(schema.goals.tenantId, schema.tenants.id))
    .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
    .where(
      and(
        eq(schema.goals.id, goalId),
        eq(schema.goals.tenantId, context.tenantId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function getBrokerGoal(period?: string): Promise<GoalRecord | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [
    eq(schema.goals.tenantId, context.tenantId),
    eq(schema.goals.scope, "broker"),
    eq(schema.goals.scopeId, context.userId),
    eq(schema.goals.active, true),
  ];

  if (period) {
    conditions.push(eq(schema.goals.period, period));
  }

  const [row] = await db
    .select(goalProgressColumns)
    .from(schema.goals)
    .leftJoin(schema.user, eq(schema.goals.createdBy, schema.user.id))
    .leftJoin(schema.branches, eq(schema.goals.scopeId, schema.branches.id))
    .leftJoin(schema.tenants, eq(schema.goals.tenantId, schema.tenants.id))
    .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
    .where(and(...conditions))
    .orderBy(desc(schema.goals.createdAt))
    .limit(1);

  return row ?? null;
}

export async function getTeamMembers(): Promise<TeamMemberOption[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      branchId: schema.tenantMemberships.branchId,
      branchName: schema.branches.name,
    })
    .from(schema.tenantMemberships)
    .innerJoin(schema.user, eq(schema.tenantMemberships.userId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.tenantMemberships.branchId, schema.branches.id))
    .where(
      and(
        eq(schema.tenantMemberships.tenantId, context.tenantId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
      ),
    )
    .orderBy(schema.user.name);
}

export async function getBranches() {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({ id: schema.branches.id, name: schema.branches.name })
    .from(schema.branches)
    .where(
      and(
        eq(schema.branches.tenantId, context.tenantId),
        eq(schema.branches.status, "active"),
      ),
    )
    .orderBy(schema.branches.name);
}

export async function getActivePeriods(): Promise<string[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const rows = await db
    .select({ period: schema.goals.period })
    .from(schema.goals)
    .where(eq(schema.goals.tenantId, context.tenantId))
    .groupBy(schema.goals.period)
    .orderBy(desc(schema.goals.period));

  return rows.map((r) => r.period);
}
