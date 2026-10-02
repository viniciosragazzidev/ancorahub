import "server-only";

import { and, asc, desc, eq, isNull } from "drizzle-orm";

import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { resolveReportDataScope } from "./metric-scope";
import {
  getLeadQualityReport,
  leadOriginExpression,
  leadQualityCohortWhere,
  leadShiftExpression,
  type LeadOrigin,
  type LeadQualityFilters,
  type LeadQualityReport,
} from "./lead-quality-service";
import { leadQualityWindow, type LeadQualityPeriod, type LeadShift } from "./lead-quality-period";

/** Lead rows in the export (PDF list and spreadsheet). */
export const LEAD_QUALITY_EXPORT_LEADS_LIMIT = 2000;

export type LeadQualityExportLead = {
  id: string;
  name: string;
  origin: LeadOrigin;
  shift: LeadShift;
  createdAt: Date;
  queueName: string | null;
  brokerName: string | null;
  qualificationStatus: string;
  status: string;
  sourceCampaign: string | null;
  city: string | null;
  planType: string | null;
};

export type LeadQualityExport = {
  report: LeadQualityReport;
  queueName: string | null;
  leads: LeadQualityExportLead[];
  leadsTruncated: boolean;
};

/** Queues offered by the page / export filter: only active, not deleted ones. */
export async function listLeadQualityQueues(tenantId: string) {
  return getDatabase()
    .select({ id: schema.leadQueues.id, name: schema.leadQueues.name })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.status, "active"), isNull(schema.leadQueues.deletedAt)))
    .orderBy(asc(schema.leadQueues.name));
}

/** Everything the report needs: the page's numbers for the selection, plus its leads. */
export async function getLeadQualityExport(context: TenantContext, period: LeadQualityPeriod, filters: LeadQualityFilters, now = new Date()): Promise<LeadQualityExport> {
  const report = await getLeadQualityReport(context, period, null, filters, { audit: false, now });
  const db = getDatabase();
  const scope = await resolveReportDataScope(context);
  const window = leadQualityWindow(period, now);

  const [queueRow] = filters.queueId
    ? await db.select({ name: schema.leadQueues.name }).from(schema.leadQueues).where(and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.id, filters.queueId))).limit(1)
    : [];

  const rows = report.enabled ? await db.select({
    id: schema.leads.id,
    name: schema.leads.nome,
    origin: leadOriginExpression(),
    shift: leadShiftExpression(),
    createdAt: schema.leads.createdAt,
    queueName: schema.leadQueues.name,
    brokerName: schema.user.name,
    qualificationStatus: schema.leads.qualificationStatus,
    status: schema.leads.status,
    sourceCampaign: schema.leads.sourceCampaign,
    qualificationDetails: schema.leads.qualificationDetails,
  }).from(schema.leads)
    .leftJoin(schema.leadQueues, and(eq(schema.leadQueues.tenantId, context.tenantId), eq(schema.leadQueues.id, schema.leads.queueId)))
    .leftJoin(schema.user, eq(schema.user.id, schema.leads.corretorId))
    .where(and(
      eq(schema.leads.tenantId, scope.tenantId),
      isNull(schema.leads.deletedAt),
      isNull(schema.leads.archivedAt),
      leadQualityCohortWhere(window, filters),
      scope.leadScope,
    ))
    .orderBy(desc(schema.leads.createdAt))
    .limit(LEAD_QUALITY_EXPORT_LEADS_LIMIT + 1) : [];

  const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    report,
    queueName: queueRow?.name ?? null,
    leadsTruncated: rows.length > LEAD_QUALITY_EXPORT_LEADS_LIMIT,
    leads: rows.slice(0, LEAD_QUALITY_EXPORT_LEADS_LIMIT).map(({ qualificationDetails, ...row }) => {
      const details = (qualificationDetails ?? {}) as Record<string, unknown>;
      return { ...row, shift: Number(row.shift) === 2 ? 2 : 1, city: text(details.city), planType: text(details.planType) };
    }),
  };
}
