import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

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

  const conditions = [eq(schema.sales.tenantId, context.tenantId)];

  // Apply scope filtering based on role
  if (context.role === "broker") {
    conditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

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
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
    .leftJoin(schema.clients, eq(schema.sales.clientId, schema.clients.id))
    .innerJoin(schema.user, eq(schema.sales.brokerId, schema.user.id))
    .leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id))
    .leftJoin(schema.carrierPlans, eq(schema.sales.carrierPlanId, schema.carrierPlans.id))
    .leftJoin(schema.carriers, eq(schema.carrierPlans.carrierId, schema.carriers.id))
    .leftJoin(schema.commissionRules, eq(schema.sales.commissionRuleId, schema.commissionRules.id))
    .where(and(...conditions))
    .orderBy(desc(schema.sales.createdAt));
}

export async function getSaleById(saleId: string): Promise<SaleRecord | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [
    eq(schema.sales.id, saleId),
    eq(schema.sales.tenantId, context.tenantId),
  ];

  // Apply scope
  if (context.role === "broker") {
    conditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

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
    .innerJoin(schema.leads, eq(schema.sales.leadId, schema.leads.id))
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
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .where(
      and(
        eq(schema.commissionSchedule.saleId, saleId),
        eq(schema.sales.tenantId, context.tenantId),
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

  const salesConditions = [eq(schema.sales.tenantId, context.tenantId)];

  if (context.role === "broker") {
    salesConditions.push(eq(schema.sales.brokerId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    salesConditions.push(eq(schema.sales.brokerId, context.userId));
  }

  const [salesSummary] = await db
    .select({
      totalRevenue: sql<string>`COALESCE(SUM(${schema.sales.saleValue}), 0)`,
      salesCount: sql<number>`COUNT(*)`,
    })
    .from(schema.sales)
    .where(and(...salesConditions));

  const [totalComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .where(eq(schema.sales.tenantId, context.tenantId));

  const [pendingComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .where(
      and(
        eq(schema.sales.tenantId, context.tenantId),
        eq(schema.commissionSchedule.status, "pending"),
      ),
    );

  const [paidComm] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${schema.commissionSchedule.amount}), 0)`,
    })
    .from(schema.commissionSchedule)
    .innerJoin(schema.sales, eq(schema.commissionSchedule.saleId, schema.sales.id))
    .where(
      and(
        eq(schema.sales.tenantId, context.tenantId),
        eq(schema.commissionSchedule.status, "paid"),
      ),
    );

  return {
    totalRevenue: salesSummary?.totalRevenue ?? "0",
    totalCommissions: totalComm?.total ?? "0",
    pendingCommissions: pendingComm?.total ?? "0",
    paidCommissions: paidComm?.total ?? "0",
    salesCount: salesSummary?.salesCount ?? 0,
  };
}
