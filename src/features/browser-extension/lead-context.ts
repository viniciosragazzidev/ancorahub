import "server-only";

import { and, eq, isNull, or, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { maskPhone, normalizePhone } from "./schemas";

export function isExtensionLeadVisibleForUser(context: Pick<TenantContext, "userId" | "branchId">, lead: { corretorId: string | null; branchId: string | null }) {
  return Boolean(
    context.branchId
    && lead.branchId === context.branchId
    && lead.corretorId === context.userId,
  );
}

export function selectVisibleExtensionLead<T extends { corretorId: string | null; branchId: string | null }>(context: Pick<TenantContext, "userId" | "branchId">, candidates: T[]) {
  return candidates.find((lead) => isExtensionLeadVisibleForUser(context, lead));
}

export async function resolveLeadForExtension(context: TenantContext, phone: string) {
  const normalized = normalizePhone(phone).replace(/\D/g, "");
  if (!normalized) return { status: "NOT_FOUND" as const };
  const db = getDatabase();
  const candidates = await db.select({
    id: schema.leads.id, tenantId: schema.leads.tenantId, nome: schema.leads.nome, telefone: schema.leads.telefone,
    status: schema.leads.status, version: schema.leads.version, qualificationStatus: schema.leads.qualificationStatus, origem: schema.leads.origem,
    sourceCampaign: schema.leads.sourceCampaign, branchId: schema.leads.branchId, branchName: schema.branches.name,
    corretorId: schema.leads.corretorId, corretorName: schema.user.name,
  }).from(schema.leads).leftJoin(schema.branches, eq(schema.leads.branchId, schema.branches.id)).leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id)).where(and(eq(schema.leads.tenantId, context.tenantId), sql`regexp_replace(${schema.leads.telefone}, '[^0-9]', '', 'g') = ${normalized}`));
  if (!candidates.length) return { status: "NOT_FOUND" as const };
  const lead = selectVisibleExtensionLead(context, candidates);
  if (!lead) return { status: "FORBIDDEN" as const };
  const [nextTask] = await db.select({ id: schema.leadTasks.id, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt }).from(schema.leadTasks).where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, lead.id), isNull(schema.leadTasks.completedAt), or(eq(schema.leadTasks.assignedTo, context.userId), eq(schema.leadTasks.assignedTo, lead.corretorId ?? context.userId)))).orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`).limit(1);
  return {
    status: "FOUND" as const,
    lead: {
      id: lead.id, version: lead.version, name: lead.nome, phoneMasked: maskPhone(lead.telefone),
      currentStatus: { id: lead.status, label: LEAD_STATUS_LABELS[lead.status] ?? lead.status },
      origin: lead.origem, sourceCampaign: lead.sourceCampaign ?? undefined,
      unit: lead.branchId && lead.branchName ? { id: lead.branchId, name: lead.branchName } : null,
      assignedUser: lead.corretorId && lead.corretorName ? { id: lead.corretorId, name: lead.corretorName } : null,
      nextAction: nextTask ? { id: nextTask.id, title: nextTask.title, dueAt: nextTask.dueAt?.toISOString() ?? null, status: "PENDING" as const } : null,
      qualification: { completed: lead.qualificationStatus === "qualified" ? ["qualification"] : [], missing: lead.qualificationStatus === "qualified" ? [] : ["qualification"] },
      allowedActions: ["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"],
    },
  };
}

export async function getLeadForExtension(context: TenantContext, leadId: string) {
  const [lead] = await getDatabase().select({ id: schema.leads.id, tenantId: schema.leads.tenantId, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId, status: schema.leads.status, version: schema.leads.version }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead || !isExtensionLeadVisibleForUser(context, lead)) return null;
  return lead;
}
