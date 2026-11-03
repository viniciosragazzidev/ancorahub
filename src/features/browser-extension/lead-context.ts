import "server-only";

import { and, asc, desc, eq, gt, inArray, isNull, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import type { TenantContext } from "@/shared/auth/types";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { greetingFactsFromLead } from "@/features/leads/broker-greeting";
import { extensionLeadPayloadSchema, extensionTemperature } from "./payload";
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
    queueName: schema.leadQueues.name, dutyName: schema.unitDutySchedules.name, planName: schema.carrierPlans.name,
    assignedAt: schema.leads.assignedAt, livesCount: schema.leads.livesCount, monthlyValue: schema.leads.monthlyValue,
    qualificationDetails: schema.leads.qualificationDetails, formData: schema.leads.formData,
    sourceMetadata: schema.leads.sourceMetadata, sourceChannel: schema.leads.sourceChannel,
  }).from(schema.leads)
    .leftJoin(schema.branches, and(eq(schema.leads.branchId, schema.branches.id), eq(schema.branches.tenantId, context.tenantId)))
    .leftJoin(schema.user, eq(schema.leads.corretorId, schema.user.id))
    .leftJoin(schema.leadQueues, and(eq(schema.leads.queueId, schema.leadQueues.id), eq(schema.leadQueues.tenantId, context.tenantId)))
    .leftJoin(schema.unitDutySchedules, and(eq(schema.leads.dutyScheduleId, schema.unitDutySchedules.id), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
    .leftJoin(schema.carrierPlans, and(eq(schema.leads.planId, schema.carrierPlans.id), eq(schema.carrierPlans.tenantId, context.tenantId)))
    .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.corretorId, context.userId), context.branchId ? eq(schema.leads.branchId, context.branchId) : sql`false`, isNull(schema.leads.deletedAt), isNull(schema.leads.archivedAt), sql`regexp_replace(${schema.leads.telefone}, '[^0-9]', '', 'g') = ${normalized}`));
  if (!candidates.length) return { status: "NOT_FOUND" as const };
  const lead = selectVisibleExtensionLead(context, candidates);
  if (!lead) return { status: "NOT_FOUND" as const };
  const [[nextTask], [offer], history] = await Promise.all([
    db.select({ id: schema.leadTasks.id, title: schema.leadTasks.title, dueAt: schema.leadTasks.dueAt }).from(schema.leadTasks)
      .where(and(eq(schema.leadTasks.tenantId, context.tenantId), eq(schema.leadTasks.leadId, lead.id), isNull(schema.leadTasks.completedAt), eq(schema.leadTasks.assignedTo, context.userId)))
      .orderBy(sql`${schema.leadTasks.dueAt} asc nulls last`).limit(1),
    // Same pending-offer arrival as Minha fila; never use the brokerage capture date.
    db.select({ offeredAt: schema.leadOffers.offeredAt, dutyName: schema.unitDutySchedules.name }).from(schema.leadOffers)
      .leftJoin(schema.unitDutySchedules, and(eq(schema.unitDutySchedules.id, schema.leadOffers.dutyScheduleId), eq(schema.unitDutySchedules.tenantId, context.tenantId)))
      .where(and(eq(schema.leadOffers.tenantId, context.tenantId), eq(schema.leadOffers.brokerId, context.userId), eq(schema.leadOffers.leadId, lead.id),
        inArray(schema.leadOffers.status, ["PENDING", "SENT", "DELIVERED", "READ"]), gt(schema.leadOffers.expiresAt, new Date())))
      .orderBy(asc(schema.leadOffers.expiresAt)).limit(1),
    db.select({ tipo: schema.leadInteractions.tipo, createdAt: schema.leadInteractions.createdAt }).from(schema.leadInteractions)
      .innerJoin(schema.leads, eq(schema.leads.id, schema.leadInteractions.leadId))
      .where(and(eq(schema.leads.tenantId, context.tenantId), eq(schema.leads.id, lead.id), eq(schema.leads.corretorId, context.userId),
        context.branchId ? eq(schema.leads.branchId, context.branchId) : sql`false`))
      .orderBy(desc(schema.leadInteractions.createdAt), desc(schema.leadInteractions.id)).limit(5),
  ]);
  const statusLabel = LEAD_STATUS_LABELS[lead.status] ?? lead.status;
  const lives = lead.livesCount ?? greetingFactsFromLead(lead).livesCount;
  const monthlyValue = lead.monthlyValue == null ? undefined : Number(lead.monthlyValue);
  const nextAction = nextTask ? { id: nextTask.id, title: nextTask.title, dueAt: nextTask.dueAt?.toISOString() ?? null, status: "PENDING" as const } : null;
  return {
    status: "FOUND" as const,
    lead: extensionLeadPayloadSchema.parse({
      id: lead.id, version: lead.version, name: lead.nome, phoneMasked: maskPhone(lead.telefone),
      currentStatus: { id: lead.status, label: statusLabel },
      origin: lead.origem, sourceCampaign: lead.sourceCampaign ?? undefined,
      unit: lead.branchId && lead.branchName ? { id: lead.branchId, name: lead.branchName } : null,
      assignedUser: lead.corretorId && lead.corretorName ? { id: lead.corretorId, name: lead.corretorName } : null,
      nextAction,
      qualification: { completed: lead.qualificationStatus === "qualified" ? ["qualification"] : [], missing: lead.qualificationStatus === "qualified" ? [] : ["qualification"] },
      allowedActions: ["VIEW_LEAD", "CHANGE_STATUS", "REGISTER_FEEDBACK", "CREATE_TASK", "GENERATE_REPLY"],
      etapa: statusLabel, unidade: lead.branchName ?? undefined, corretor: lead.corretorName ?? undefined,
      proximoPasso: nextAction ? { titulo: nextAction.title, prazo: nextAction.dueAt } : null,
      temperatura: extensionTemperature(lead.qualificationStatus), plano: lead.planName ?? undefined,
      fila: lead.queueName ?? undefined, plantao: offer?.dutyName ?? lead.dutyName ?? undefined,
      chegouEm: (offer?.offeredAt ?? lead.assignedAt)?.toISOString() ?? null,
      vidas: lives != null && Number.isInteger(lives) && lives > 0 ? lives : undefined,
      valorMensal: monthlyValue !== undefined && Number.isFinite(monthlyValue) && monthlyValue >= 0 ? monthlyValue : undefined,
      historico: history.map((item) => ({ tipo: item.tipo, data: item.createdAt.toISOString() })),
    }),
  };
}

export async function getLeadForExtension(context: TenantContext, leadId: string) {
  const [lead] = await getDatabase().select({ id: schema.leads.id, tenantId: schema.leads.tenantId, corretorId: schema.leads.corretorId, branchId: schema.leads.branchId, status: schema.leads.status, version: schema.leads.version }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId))).limit(1);
  if (!lead || !isExtensionLeadVisibleForUser(context, lead)) return null;
  return lead;
}
