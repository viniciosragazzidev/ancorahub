import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import { resolveReportDataScope } from "@/features/reports/metrics/metric-scope";
import { buildStrictRoleLeadScope } from "@/features/leads/strict-role-scope";

export type SaleRecord = {
  id: string;
  leadId: string;
  leadName: string;
  clientId: string | null;
  clientName: string | null;
  brokerId: string;
  brokerName: string | null;
  branchId: string | null;
  branchName: string | null;
  carrierPlanId: string | null;
  planName: string | null;
  carrierName: string | null;
  commissionRuleId: string | null;
  ruleName: string | null;
  saleDate: Date;
  saleValue: string;
  status: "active" | "cancelled";
  notes: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getSales(): Promise<SaleRecord[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const reportScope = await resolveReportDataScope(context);
  const leadScope = buildStrictRoleLeadScope(context, reportScope);

  return db
    .select({
      id: schema.sales.id,
      leadId: schema.sales.leadId,
      leadName: schema.leads.nome,
      clientId: schema.sales.clientId,
      clientName: schema.clients.nome,
      brokerId: schema.sales.brokerId,
      brokerName: schema.user.name,
      branchId: schema.leads.branchId,
      branchName: schema.branches.name,
      carrierPlanId: schema.sales.carrierPlanId,
      planName: schema.carrierPlans.name,
      carrierName: schema.carriers.name,
      commissionRuleId: schema.sales.commissionRuleId,
      ruleName: schema.commissionRules.name,
      saleDate: schema.sales.saleDate,
      saleValue: schema.sales.saleValue,
      status: schema.sales.status,
      notes: schema.sales.notes,
      createdBy: schema.sales.createdBy,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, and(eq(schema.sales.leadId, schema.leads.id), eq(schema.sales.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.clients, eq(schema.sales.clientId, schema.clients.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .leftJoin(schema.commissionRules, eq(schema.sales.commissionRuleId, schema.commissionRules.id))
    .where(and(eq(schema.sales.tenantId, context.tenantId), leadScope, reportScope.salesBrokerScope))
    .orderBy(desc(schema.sales.createdAt));
}

export async function getSaleById(saleId: string): Promise<SaleRecord | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const reportScope = await resolveReportDataScope(context);
  const leadScope = buildStrictRoleLeadScope(context, reportScope);

  const conditions = [
    eq(schema.sales.id, saleId),
    eq(schema.sales.tenantId, context.tenantId),
    eq(schema.sales.tenantId, schema.leads.tenantId),
    leadScope,
    reportScope.salesBrokerScope,
  ];

  const [row] = await db
    .select({
      id: schema.sales.id,
      leadId: schema.sales.leadId,
      leadName: schema.leads.nome,
      clientId: schema.sales.clientId,
      clientName: schema.clients.nome,
      brokerId: schema.sales.brokerId,
      brokerName: schema.user.name,
      branchId: schema.leads.branchId,
      branchName: schema.branches.name,
      carrierPlanId: schema.sales.carrierPlanId,
      planName: schema.carrierPlans.name,
      carrierName: schema.carriers.name,
      commissionRuleId: schema.sales.commissionRuleId,
      ruleName: schema.commissionRules.name,
      saleDate: schema.sales.saleDate,
      saleValue: schema.sales.saleValue,
      status: schema.sales.status,
      notes: schema.sales.notes,
      createdBy: schema.sales.createdBy,
      createdAt: schema.sales.createdAt,
      updatedAt: schema.sales.updatedAt,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, and(eq(schema.sales.leadId, schema.leads.id), eq(schema.sales.tenantId, schema.leads.tenantId)))
    .leftJoin(schema.clients, eq(schema.sales.clientId, schema.clients.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .leftJoin(schema.commissionRules, eq(schema.sales.commissionRuleId, schema.commissionRules.id))
    .where(and(...conditions))
    .limit(1);

  return row ?? null;
}

export type CommissionScheduleItem = {
  id: string;
  saleId: string;
  monthNumber: number;
  referenceMonth: string;
  dueDate: Date | null;
  percentage: string;
  amount: string;
  status: "pending" | "paid" | "cancelled" | "chargeback_pending";
  paidAt: Date | null;
  paidBy: string | null;
  paidByName: string | null;
  notes: string | null;
};

export async function getCommissionSchedule(saleId: string): Promise<CommissionScheduleItem[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const reportScope = await resolveReportDataScope(context);
  const leadScope = buildStrictRoleLeadScope(context, reportScope);

  return db
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
      paidBy: schema.commissionSchedule.paidBy,
      paidByName: schema.user.name,
      notes: schema.commissionSchedule.notes,
    })
    .from(schema.commissionSchedule)
    .leftJoin(schema.user, eq(schema.commissionSchedule.paidBy, schema.user.id))
    .innerJoin(schema.sales, and(eq(schema.commissionSchedule.saleId, schema.sales.id), eq(schema.commissionSchedule.tenantId, schema.sales.tenantId)))
    .innerJoin(schema.leads, and(eq(schema.sales.leadId, schema.leads.id), eq(schema.sales.tenantId, schema.leads.tenantId)))
    .where(
      and(
        eq(schema.commissionSchedule.saleId, saleId),
        eq(schema.sales.tenantId, context.tenantId),
        leadScope,
        reportScope.salesBrokerScope,
      ),
    )
    .orderBy(schema.commissionSchedule.monthNumber);
}

export type SaleSummary = {
  totalRevenue: string;
  totalCommissions: string;
  pendingCommissions: string;
  paidCommissions: string;
  salesCount: number;
};

export async function getSaleSummary(): Promise<SaleSummary> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();
  const reportScope = await resolveReportDataScope(context);
  const leadScope = buildStrictRoleLeadScope(context, reportScope);
  const salesConditions = [eq(schema.sales.tenantId, context.tenantId), leadScope, reportScope.salesBrokerScope];

  const [salesSummary] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)`,
      salesCount: sql<number>`COUNT(*)`,
    })
    .from(schema.sales)
    .innerJoin(schema.leads, and(eq(schema.sales.leadId, schema.leads.id), eq(schema.sales.tenantId, schema.leads.tenantId)))
    .where(and(...salesConditions));

  const commissionScope = [
    eq(schema.commissionSchedule.tenantId, context.tenantId),
    eq(schema.sales.tenantId, context.tenantId),
    leadScope,
    reportScope.salesBrokerScope,
  ];
  const commissionTotal = (status?: "pending" | "paid") => db
    .select({ total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)` })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, and(eq(schema.commissionSchedule.saleId, schema.sales.id), eq(schema.commissionSchedule.tenantId, schema.sales.tenantId)))
    .innerJoin(schema.leads, and(eq(schema.sales.leadId, schema.leads.id), eq(schema.sales.tenantId, schema.leads.tenantId)))
    .where(and(...commissionScope, status ? eq(schema.commissionSchedule.status, status) : undefined));
  const [[totalComm], [pendingComm], [paidComm]] = await Promise.all([
    commissionTotal(),
    commissionTotal("pending"),
    commissionTotal("paid"),
  ]);

  return {
    totalRevenue: salesSummary?.totalRevenue ?? "0",
    totalCommissions: totalComm?.total ?? "0",
    pendingCommissions: pendingComm?.total ?? "0",
    paidCommissions: paidComm?.total ?? "0",
    salesCount: salesSummary?.salesCount ?? 0,
  };
}
