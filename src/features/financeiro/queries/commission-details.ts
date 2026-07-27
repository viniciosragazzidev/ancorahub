import "server-only";

import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

// ─── Types ──────────────────────────────────────────────────────────────────

export type BrokerCommissionSummary = {
  brokerId: string;
  brokerName: string | null;
  branchName: string | null;
  totalSales: number;
  totalSaleValue: string;
  totalCommission: string;
  pendingCommission: string;
  paidCommission: string;
};

export type SaleCommissionDetail = {
  saleId: string;
  leadName: string;
  brokerName: string | null;
  branchName: string | null;
  planName: string | null;
  carrierName: string | null;
  ruleName: string | null;
  saleDate: Date;
  saleValue: string;
  status: "active" | "cancelled";
  scheduleItems: Array<{
    id: string;
    monthNumber: number;
    referenceMonth: string;
    dueDate: Date | null;
    percentage: string;
    amount: string;
      status: "pending" | "paid" | "cancelled" | "chargeback_pending";
    paidAt: Date | null;
    paidByName: string | null;
  }>;
};

export type CommissionDetailsData = {
  summary: {
    totalCommission: string;
    pendingCommission: string;
    paidCommission: string;
    totalSales: number;
    activeRules: number;
    brokersWithCommission: number;
  };
  byBroker: BrokerCommissionSummary[];
  bySale: SaleCommissionDetail[];
};

// ─── Query ──────────────────────────────────────────────────────────────────

export async function getCommissionDetailsData(): Promise<CommissionDetailsData> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  // Scope conditions
  const scopeConditions: (SQL<unknown> | undefined)[] = [eq(schema.sales.tenantId, context.tenantId)];
  if (context.role === "broker") {
    scopeConditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    scopeConditions.push(eq(schema.leads.branchId, context.branchId));
  }

  // ── Commission totals ──
  const [totalComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(and(...scopeConditions));

  const [pendingComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(
      and(
        ...scopeConditions,
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
        ...scopeConditions,
        eq(schema.commissionSchedule.status, "paid"),
      ),
    );

  // ── Sales count ──
  const [salesCountResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(and(...scopeConditions));

  // ── Active rules count ──
  const [rulesResult] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(schema.commissionRules)
    .where(
      and(
        eq(schema.commissionRules.tenantId, context.tenantId),
        eq(schema.commissionRules.active, true),
      ),
    );

  // ── Broker commission summaries ──
  // Compute sale values separately (without schedule join to avoid duplicates)
  const saleValuesByBroker = await db
    .select({
      brokerId: schema.sales.brokerId,
      totalSales: sql<number>`COUNT(*)::int`,
      totalSaleValue: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)`,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .where(and(...scopeConditions))
    .groupBy(schema.sales.brokerId);

  const saleValueMap = new Map(saleValuesByBroker.map((r) => [r.brokerId, r]));

  const brokerSummaries = await db
    .select({
      brokerId: schema.sales.brokerId,
      brokerName: schema.user.name,
      branchName: schema.branches.name,
      totalCommission: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
      pendingCommission: sql<string>`COALESCE(SUM(CASE WHEN ${schema.commissionSchedule.status} = 'pending' THEN ${schema.commissionSchedule.amount} ELSE 0 END), 0)`,
      paidCommission: sql<string>`COALESCE(SUM(CASE WHEN ${schema.commissionSchedule.status} = 'paid' THEN ${schema.commissionSchedule.amount} ELSE 0 END), 0)`,
    })
    .from(schema.sales)
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.commissionSchedule, eq(schema.sales.id, schema.commissionSchedule.saleId))
    .where(and(...scopeConditions))
    .groupBy(schema.sales.brokerId, schema.user.name, schema.branches.name)
    .orderBy(sql`COALESCE(SUM(${schema.commissionSchedule.amount}), 0) DESC`);

  // Merge sale values into broker summaries
  const byBroker: BrokerCommissionSummary[] = brokerSummaries.map((row) => {
    const saleInfo = saleValueMap.get(row.brokerId);
    return {
      brokerId: row.brokerId,
      brokerName: row.brokerName,
      branchName: row.branchName,
      totalSales: saleInfo?.totalSales ?? 0,
      totalSaleValue: saleInfo?.totalSaleValue ?? "0",
      totalCommission: row.totalCommission,
      pendingCommission: row.pendingCommission,
      paidCommission: row.paidCommission,
    };
  });

  // ── Sales with all schedule items ──
  const salesResults = await db
    .select({
      saleId: schema.sales.id,
      leadName: schema.leads.nome,
      brokerName: schema.user.name,
      branchName: schema.branches.name,
      planName: schema.carrierPlans.name,
      carrierName: schema.carriers.name,
      ruleName: schema.commissionRules.name,
      saleDate: schema.sales.saleDate,
      saleValue: schema.sales.saleValue,
      status: schema.sales.status,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .leftJoin(schema.commissionRules, eq(schema.sales.commissionRuleId, schema.commissionRules.id))
    .where(and(...scopeConditions))
    .orderBy(desc(schema.sales.createdAt));

  // ── Schedule items for all sales ──
  const saleIds = salesResults.map((s) => s.saleId);
  const scheduleRows = saleIds.length > 0
    ? await db
        .select({
          id: schema.commissionSchedule.id,
          saleId: schema.commissionSchedule.saleId,
          monthNumber: schema.commissionSchedule.monthNumber,
          referenceMonth: schema.commissionSchedule.referenceMonth,
          dueDate: schema.commissionSchedule.dueDate,
          percentage: schema.commissionSchedule.percentage,
          amount: schema.commissionSchedule.amount,
          status: schema.commissionSchedule.status,
          paidAt: schema.commissionSchedule.paidAt,
          paidByName: schema.user.name,
        })
        .from(schema.commissionSchedule)
        .leftJoin(schema.user, eq(schema.commissionSchedule.paidBy, schema.user.id))
        .where(
          and(
            eq(schema.commissionSchedule.tenantId, context.tenantId),
            sql`${schema.commissionSchedule.saleId} = ANY(${sql`ARRAY[${sql.join(saleIds.map((id) => sql`${id}`), sql`, `)}]`})`,
          ),
        )
        .orderBy(schema.commissionSchedule.monthNumber)
    : [];

  // Group schedule items by saleId
  const scheduleBySale = new Map<string, typeof scheduleRows>();
  for (const row of scheduleRows) {
    const existing = scheduleBySale.get(row.saleId) ?? [];
    existing.push(row);
    scheduleBySale.set(row.saleId, existing);
  }

  // Build full sale detail records
  const bySale: SaleCommissionDetail[] = salesResults.map((sale) => ({
    saleId: sale.saleId,
    leadName: sale.leadName,
    brokerName: sale.brokerName,
    branchName: sale.branchName,
    planName: sale.planName,
    carrierName: sale.carrierName,
    ruleName: sale.ruleName,
    saleDate: sale.saleDate,
    saleValue: sale.saleValue,
    status: sale.status,
    scheduleItems: (scheduleBySale.get(sale.saleId) ?? []).map((item) => ({
      id: item.id,
      monthNumber: item.monthNumber,
      referenceMonth: item.referenceMonth,
      dueDate: item.dueDate,
      percentage: item.percentage,
      amount: item.amount,
      status: item.status,
      paidAt: item.paidAt,
      paidByName: item.paidByName,
    })),
  }));

  const brokersWithCommission = brokerSummaries.filter(
    (b) => parseFloat(b.totalCommission) > 0,
  ).length;

  return {
    summary: {
      totalCommission: totalComm?.total ?? "0",
      pendingCommission: pendingComm?.total ?? "0",
      paidCommission: paidComm?.total ?? "0",
      totalSales: salesCountResult?.count ?? 0,
      activeRules: rulesResult?.count ?? 0,
      brokersWithCommission,
    },
    byBroker,
    bySale,
  };
}
