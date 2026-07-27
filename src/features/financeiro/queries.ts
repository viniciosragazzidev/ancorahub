import "server-only";

import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type FinancialDashboardData = {
  summary: {
    totalRevenue: string;
    totalCommissions: string;
    pendingCommissions: string;
    paidCommissions: string;
    salesCount: number;
    activeGoals: number;
    periodRevenue: string;
    periodCommissions: string;
  };
  recentSales: Array<{
    id: string;
    leadName: string;
    brokerName: string | null;
    saleDate: Date;
    saleValue: string;
    commissionAmount: string | null;
    status: "active" | "cancelled";
  }>;
  pendingSchedules: Array<{
    id: string;
    saleId: string;
    leadName: string;
    referenceMonth: string;
    dueDate: Date | null;
    amount: string;
    percentage: string;
    monthNumber: number;
  }>;
  activeGoals: Array<{
    id: string;
    name: string;
    scope: string;
    targetType: string;
    targetValue: string;
    currentValue: string | null;
    percentage: string | null;
    period: string;
  }>;
  monthlyTrend: Array<{
    month: string;
    revenue: string;
    commissions: string;
  }>;
};

// ─── Query ──────────────────────────────────────────────────────────────────

export async function getFinancialDashboardData(): Promise<FinancialDashboardData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Scope conditions
  const salesConditions = [eq(schema.sales.tenantId, context.tenantId)];
  if (context.role === "broker") {
    salesConditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    salesConditions.push(eq(schema.leads.branchId, context.branchId));
  }

  // Current period dates
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // ── All-time summary ──
  const [allTimeSummary] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)`,
      salesCount: sql<number>`COUNT(*)`,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(and(...salesConditions));

  // ── Period summary ──
  const periodConditions = [
    ...salesConditions,
    gte(schema.sales.saleDate, periodStart),
    lte(schema.sales.saleDate, periodEnd),
  ];

  const [periodSummary] = await db
    .select({
      revenue: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)`,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(and(...periodConditions));

  // ── Commission totals ──
  const commissionConditions = [eq(schema.sales.tenantId, context.tenantId)];
  if (context.role === "broker") {
    commissionConditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    commissionConditions.push(eq(schema.leads.branchId, context.branchId));
  }

  const [totalComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(and(...commissionConditions));

  const [pendingComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(
      and(
        ...commissionConditions,
        eq(schema.commissionSchedule.status, "pending"),
      ),
    );

  const [paidComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(
      and(
        ...commissionConditions,
        eq(schema.commissionSchedule.status, "paid"),
      ),
    );

  // ── Active goals count ──
  const goalsConditions: (SQL<unknown> | undefined)[] = [
    eq(schema.goals.tenantId, context.tenantId),
    eq(schema.goals.active, true),
    lte(schema.goals.startDate, now),
    gte(schema.goals.endDate, now),
  ];
  if (context.role === "broker") {
    goalsConditions.push(
      and(
        eq(schema.goals.scope, "broker"),
        eq(schema.goals.scopeId, context.userId),
      ),
    );
  }

  const [goalsResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.goals)
    .where(and(...goalsConditions));
  const activeGoals = goalsResult?.count ?? 0;

  // ── Recent sales (last 10) ──
  const recentSales = await db
    .select({
      id: schema.sales.id,
      leadName: schema.leads.nome,
      brokerName: schema.user.name,
      saleDate: schema.sales.saleDate,
      saleValue: schema.sales.saleValue,
      commissionAmount: sql<string | null>`COALESCE(${schema.commissionSchedule.amount}::text, null)`,
      status: schema.sales.status,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.commissionSchedule, eq(schema.sales.id, schema.commissionSchedule.saleId))
    .where(and(...salesConditions))
    .orderBy(desc(schema.sales.createdAt))
    .limit(10);

  // ── Pending commission schedules (next 5 upcoming) ──
  const pendingSchedules = await db
    .select({
      id: schema.commissionSchedule.id,
      saleId: schema.commissionSchedule.saleId,
      leadName: schema.leads.nome,
      referenceMonth: schema.commissionSchedule.referenceMonth,
      dueDate: schema.commissionSchedule.dueDate,
      amount: schema.commissionSchedule.amount,
      percentage: schema.commissionSchedule.percentage,
      monthNumber: schema.commissionSchedule.monthNumber,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(
      and(
        eq(schema.sales.tenantId, context.tenantId),
        eq(schema.commissionSchedule.status, "pending"),
        ...(context.role === "broker" ? [eq(schema.sales.brokerId, context.userId)] : []),
        ...(context.role === "manager" && context.branchId ? [eq(schema.leads.branchId, context.branchId)] : []),
      ),
    )
    .orderBy(schema.commissionSchedule.dueDate)
    .limit(5);

  // ── Active goals with progress ──
  const activeGoalRecords = await db
    .select({
      id: schema.goals.id,
      name: schema.goals.name,
      scope: schema.goals.scope,
      targetType: schema.goals.targetType,
      targetValue: schema.goals.targetValue,
      currentValue: schema.goalProgress.currentValue,
      percentage: schema.goalProgress.percentage,
      period: schema.goals.period,
    })
    .from(schema.goals)
    .leftJoin(schema.goalProgress, eq(schema.goals.id, schema.goalProgress.goalId))
    .where(and(...goalsConditions))
    .orderBy(desc(schema.goals.createdAt))
    .limit(5);

  // ── Monthly trend (last 6 months) ──
  const monthlyTrend: Array<{ month: string; revenue: string; commissions: string }> = [];
  for (let i = 5; i >= 0; i--) {
    const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthLabel = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
    const mStart = new Date(m.getFullYear(), m.getMonth(), 1);
    const mEnd = new Date(m.getFullYear(), m.getMonth() + 1, 0, 23, 59, 59);

    const [mRev] = await db
      .select({ v: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)` })
      .from(schema.sales)
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(
        and(
          ...salesConditions,
          gte(schema.sales.saleDate, mStart),
          lte(schema.sales.saleDate, mEnd),
        ),
      );

    const [mComm] = await db
      .select({ v: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)` })
      .from(schema.commissionSchedule)
      .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
      .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
      .where(
        and(
          ...commissionConditions,
          gte(schema.sales.saleDate, mStart),
          lte(schema.sales.saleDate, mEnd),
        ),
      );

    monthlyTrend.push({
      month: monthLabel,
      revenue: mRev?.v ?? "0",
      commissions: mComm?.v ?? "0",
    });
  }

  return {
    summary: {
      totalRevenue: allTimeSummary?.totalRevenue ?? "0",
      totalCommissions: totalComm?.total ?? "0",
      pendingCommissions: pendingComm?.total ?? "0",
      paidCommissions: paidComm?.total ?? "0",
      salesCount: allTimeSummary?.salesCount ?? 0,
      activeGoals,
      periodRevenue: periodSummary?.revenue ?? "0",
      periodCommissions: pendingComm?.total ?? "0",
    },
    recentSales: recentSales.map((s) => ({
      ...s,
      commissionAmount: s.commissionAmount ?? null,
    })),
    pendingSchedules,
    activeGoals: activeGoalRecords,
    monthlyTrend,
  };
}
