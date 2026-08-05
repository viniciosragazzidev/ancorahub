import "server-only";

import { and, desc, eq, lte, gte, or, sql } from "drizzle-orm";

import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";
import type { ProposalStatus } from "@/shared/db/schema";

export type ProposalRecord = {
  id: string;
  tenantId: string;
  leadId: string;
  leadName: string;
  leadPhone: string | null;
  quoteId: string | null;
  title: string;
  status: ProposalStatus;
  version: number;
  validUntil: Date;
  notes: string | null;
  documentIds: string[];
  createdBy: string;
  createdByName: string | null;
  convertedAt: Date | null;
  convertedSaleId: string | null;
  totalMonthly: string;
  beneficiaryCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getProposals(): Promise<ProposalRecord[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [eq(schema.proposals.tenantId, context.tenantId)];

  if (context.role === "broker") {
    conditions.push(eq(schema.proposals.createdBy, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

  const rows = await db
    .select({
      id: schema.proposals.id,
      tenantId: schema.proposals.tenantId,
      leadId: schema.proposals.leadId,
      leadName: schema.proposals.leadName,
      leadPhone: schema.proposals.leadPhone,
      quoteId: schema.proposals.quoteId,
      title: schema.proposals.title,
      status: schema.proposals.status,
      version: schema.proposals.version,
      validUntil: schema.proposals.validUntil,
      notes: schema.proposals.notes,
      documentIds: schema.proposals.documentIds,
      createdBy: schema.proposals.createdBy,
      createdByName: schema.user.name,
      convertedAt: schema.proposals.convertedAt,
      convertedSaleId: schema.proposals.convertedSaleId,
      totalMonthly: schema.proposals.totalMonthly,
      beneficiaryCount: schema.proposals.beneficiaryCount,
      createdAt: schema.proposals.createdAt,
      updatedAt: schema.proposals.updatedAt,
    })
    .from(schema.proposals)
    .innerJoin(schema.leads, eq(schema.proposals.leadId, schema.leads.id))
    .leftJoin(schema.user, eq(schema.proposals.createdBy, schema.user.id))
    .where(and(...conditions))
    .orderBy(desc(schema.proposals.createdAt));

  return rows.map((r) => ({
    ...r,
    documentIds: Array.isArray(r.documentIds) ? (r.documentIds as string[]) : [],
  }));
}

export async function getProposalById(id: string): Promise<ProposalRecord | null> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [
    eq(schema.proposals.id, id),
    eq(schema.proposals.tenantId, context.tenantId),
  ];

  if (context.role === "broker") {
    conditions.push(eq(schema.proposals.createdBy, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

  const [row] = await db
    .select({
      id: schema.proposals.id,
      tenantId: schema.proposals.tenantId,
      leadId: schema.proposals.leadId,
      leadName: schema.proposals.leadName,
      leadPhone: schema.proposals.leadPhone,
      quoteId: schema.proposals.quoteId,
      title: schema.proposals.title,
      status: schema.proposals.status,
      version: schema.proposals.version,
      validUntil: schema.proposals.validUntil,
      notes: schema.proposals.notes,
      documentIds: schema.proposals.documentIds,
      createdBy: schema.proposals.createdBy,
      createdByName: schema.user.name,
      convertedAt: schema.proposals.convertedAt,
      convertedSaleId: schema.proposals.convertedSaleId,
      totalMonthly: schema.proposals.totalMonthly,
      beneficiaryCount: schema.proposals.beneficiaryCount,
      createdAt: schema.proposals.createdAt,
      updatedAt: schema.proposals.updatedAt,
    })
    .from(schema.proposals)
    .innerJoin(schema.leads, eq(schema.proposals.leadId, schema.leads.id))
    .leftJoin(schema.user, eq(schema.proposals.createdBy, schema.user.id))
    .where(and(...conditions))
    .limit(1);

  if (!row) return null;

  return {
    ...row,
    documentIds: Array.isArray(row.documentIds) ? (row.documentIds as string[]) : [],
  };
}

export async function getProposalsByLead(leadId: string): Promise<ProposalRecord[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [
    eq(schema.proposals.leadId, leadId),
    eq(schema.proposals.tenantId, context.tenantId),
  ];

  if (context.role === "broker") {
    conditions.push(eq(schema.proposals.createdBy, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

  const rows = await db
    .select({
      id: schema.proposals.id,
      tenantId: schema.proposals.tenantId,
      leadId: schema.proposals.leadId,
      leadName: schema.proposals.leadName,
      leadPhone: schema.proposals.leadPhone,
      quoteId: schema.proposals.quoteId,
      title: schema.proposals.title,
      status: schema.proposals.status,
      version: schema.proposals.version,
      validUntil: schema.proposals.validUntil,
      notes: schema.proposals.notes,
      documentIds: schema.proposals.documentIds,
      createdBy: schema.proposals.createdBy,
      createdByName: schema.user.name,
      convertedAt: schema.proposals.convertedAt,
      convertedSaleId: schema.proposals.convertedSaleId,
      totalMonthly: schema.proposals.totalMonthly,
      beneficiaryCount: schema.proposals.beneficiaryCount,
      createdAt: schema.proposals.createdAt,
      updatedAt: schema.proposals.updatedAt,
    })
    .from(schema.proposals)
    .innerJoin(schema.leads, eq(schema.proposals.leadId, schema.leads.id))
    .leftJoin(schema.user, eq(schema.proposals.createdBy, schema.user.id))
    .where(and(...conditions))
    .orderBy(desc(schema.proposals.createdAt));

  return rows.map((r) => ({
    ...r,
    documentIds: Array.isArray(r.documentIds) ? (r.documentIds as string[]) : [],
  }));
}

export async function getExpiringProposals(): Promise<ProposalRecord[]> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const conditions = [
    eq(schema.proposals.tenantId, context.tenantId),
    gte(schema.proposals.validUntil, now),
    lte(schema.proposals.validUntil, sevenDaysFromNow),
    or(
      eq(schema.proposals.status, "rascunho"),
      eq(schema.proposals.status, "em_revisao"),
      eq(schema.proposals.status, "enviada"),
      eq(schema.proposals.status, "visualizada"),
      eq(schema.proposals.status, "negociacao")
    ),
  ];

  if (context.role === "broker") {
    conditions.push(eq(schema.proposals.createdBy, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

  const rows = await db
    .select({
      id: schema.proposals.id,
      tenantId: schema.proposals.tenantId,
      leadId: schema.proposals.leadId,
      leadName: schema.proposals.leadName,
      leadPhone: schema.proposals.leadPhone,
      quoteId: schema.proposals.quoteId,
      title: schema.proposals.title,
      status: schema.proposals.status,
      version: schema.proposals.version,
      validUntil: schema.proposals.validUntil,
      notes: schema.proposals.notes,
      documentIds: schema.proposals.documentIds,
      createdBy: schema.proposals.createdBy,
      createdByName: schema.user.name,
      convertedAt: schema.proposals.convertedAt,
      convertedSaleId: schema.proposals.convertedSaleId,
      totalMonthly: schema.proposals.totalMonthly,
      beneficiaryCount: schema.proposals.beneficiaryCount,
      createdAt: schema.proposals.createdAt,
      updatedAt: schema.proposals.updatedAt,
    })
    .from(schema.proposals)
    .innerJoin(schema.leads, eq(schema.proposals.leadId, schema.leads.id))
    .leftJoin(schema.user, eq(schema.proposals.createdBy, schema.user.id))
    .where(and(...conditions))
    .orderBy(desc(schema.proposals.validUntil));

  return rows.map((r) => ({
    ...r,
    documentIds: Array.isArray(r.documentIds) ? (r.documentIds as string[]) : [],
  }));
}

export async function getLeadsForProposals(): Promise<Array<{ id: string; name: string }>> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const conditions = [
    eq(schema.leads.tenantId, context.tenantId),
  ];

  if (context.role === "broker") {
    conditions.push(eq(schema.leads.corretorId, context.userId));
  } else if (context.role === "manager" && context.branchId) {
    conditions.push(eq(schema.leads.branchId, context.branchId));
  }

  conditions.push(
    sql`${schema.leads.status} NOT IN ('converted', 'lost')`
  );

  return db
    .select({
      id: schema.leads.id,
      name: schema.leads.nome,
    })
    .from(schema.leads)
    .where(and(...conditions))
    .orderBy(schema.leads.nome);
}

export async function getQuotesForProposalCreation(leadId: string): Promise<Array<{ id: string; title: string; totalMonthly: string; beneficiaryCount: number }>> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  const rows = await db
    .select({
      id: schema.quotes.id,
      totalMonthly: schema.quotes.totalMonthly,
      beneficiaryCount: schema.quotes.beneficiaryCount,
    })
    .from(schema.quotes)
    .where(
      and(
        eq(schema.quotes.leadId, leadId),
        eq(schema.quotes.tenantId, context.tenantId)
      )
    )
    .orderBy(desc(schema.quotes.createdAt));

  return rows.map((r) => ({
    id: r.id,
    title: `Cotacao #${r.id} - R$ ${r.totalMonthly ?? "0.00"}`,
    totalMonthly: r.totalMonthly ?? "0.00",
    beneficiaryCount: r.beneficiaryCount ?? 0,
  }));
}

export async function getDocumentsForProposalCreation(leadId: string): Promise<Array<{ id: string; filename: string }>> {
  const context = await getRequiredTenantContext();
  const db = getDatabase();

  return db
    .select({
      id: schema.leadDocuments.id,
      filename: schema.leadDocuments.filename,
    })
    .from(schema.leadDocuments)
    .where(
      and(
        eq(schema.leadDocuments.leadId, leadId),
        eq(schema.leadDocuments.tenantId, context.tenantId)
      )
    )
    .orderBy(schema.leadDocuments.filename);
}
