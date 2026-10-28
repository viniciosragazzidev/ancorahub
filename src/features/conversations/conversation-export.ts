import "server-only";

import { and, count, desc, eq, isNull } from "drizzle-orm";

import { buildLeadClientInfo } from "@/features/leads/client-info";
import { buildLeadScopeWhere } from "@/features/leads/lead-authorization";
import { LEAD_STATUS_LABELS } from "@/features/leads/lead-status-constants";
import { LEAD_QUALIFICATION_LABELS } from "@/features/leads/qualification-status";
import { dateTimeLabel } from "@/features/lead-distribution/report-pdf-kit";
import type { TenantContext } from "@/shared/auth/types";
import { getDatabase, schema } from "@/shared/db";

import { conversationChannelLabel, conversationMessageBody, conversationSenderLabel, type ConversationExportInput, type ConversationExportRow } from "./conversation-export-pdf";

/** The roles that export: each one inside its own scope (company, unit, team). */
export const CONVERSATION_EXPORT_ROLES = ["director", "manager", "supervisor"] as const;

export function canExportConversation(role: string | null | undefined) {
  return (CONVERSATION_EXPORT_ROLES as readonly string[]).includes(role ?? "");
}

/** A very long conversation keeps its most recent messages. */
const MAX_MESSAGES = 3000;

/**
 * The lead (only inside the exporter's scope, checked in the database), its broker and every
 * WhatsApp message of the lead, oldest first. Null when the lead is not visible to this user.
 */
export async function getConversationExportData(context: TenantContext, leadId: string, now = new Date()): Promise<ConversationExportInput | null> {
  const db = getDatabase();
  const [lead] = await db.select({
    id: schema.leads.id,
    nome: schema.leads.nome,
    telefone: schema.leads.telefone,
    email: schema.leads.email,
    tipo: schema.leads.tipo,
    status: schema.leads.status,
    qualificationStatus: schema.leads.qualificationStatus,
    sourceChannel: schema.leads.sourceChannel,
    sourceCampaign: schema.leads.sourceCampaign,
    sourceMetadata: schema.leads.sourceMetadata,
    qualificationDetails: schema.leads.qualificationDetails,
    formData: schema.leads.formData,
    createdAt: schema.leads.createdAt,
    assignedAt: schema.leads.assignedAt,
    branchId: schema.leads.branchId,
    corretorId: schema.leads.corretorId,
  }).from(schema.leads)
    .where(and(eq(schema.leads.id, leadId), isNull(schema.leads.deletedAt), buildLeadScopeWhere(context)))
    .limit(1);
  if (!lead) return null;

  const messageScope = and(eq(schema.whatsappMessages.tenantId, context.tenantId), eq(schema.whatsappMessages.leadId, lead.id));
  const [[tenant], [branch], [broker], [exporter], [{ total }], recentMessages] = await Promise.all([
    db.select({ name: schema.tenants.name, logoUrl: schema.tenants.logoUrl }).from(schema.tenants).where(eq(schema.tenants.id, context.tenantId)).limit(1),
    lead.branchId
      ? db.select({ name: schema.branches.name }).from(schema.branches).where(and(eq(schema.branches.id, lead.branchId), eq(schema.branches.tenantId, context.tenantId))).limit(1)
      : Promise.resolve([]),
    lead.corretorId
      ? db.select({ name: schema.user.name, email: schema.user.email, phone: schema.brokerProfiles.phone })
        .from(schema.user)
        .leftJoin(schema.brokerProfiles, and(eq(schema.brokerProfiles.userId, schema.user.id), eq(schema.brokerProfiles.tenantId, context.tenantId)))
        .where(eq(schema.user.id, lead.corretorId))
        .limit(1)
      : Promise.resolve([]),
    db.select({ name: schema.user.name }).from(schema.user).where(eq(schema.user.id, context.userId)).limit(1),
    db.select({ total: count() }).from(schema.whatsappMessages).where(messageScope),
    db.select({
      sentAt: schema.whatsappMessages.sentAt,
      direction: schema.whatsappMessages.direction,
      senderRole: schema.whatsappMessages.senderRole,
      provider: schema.whatsappMessages.provider,
      body: schema.whatsappMessages.body,
      mediaKind: schema.whatsappMessages.mediaKind,
      mediaFilename: schema.whatsappMessages.mediaFilename,
    }).from(schema.whatsappMessages).where(messageScope)
      .orderBy(desc(schema.whatsappMessages.sentAt), desc(schema.whatsappMessages.id))
      .limit(MAX_MESSAGES),
  ]);

  const qualification = lead.qualificationStatus ? (LEAD_QUALIFICATION_LABELS as Record<string, string>)[lead.qualificationStatus] ?? null : null;
  const leadRows: ConversationExportRow[] = [
    { label: "Nome", value: lead.nome },
    { label: "Status", value: LEAD_STATUS_LABELS[lead.status ?? ""] ?? lead.status ?? "" },
    { label: "Temperatura", value: qualification ?? "" },
    { label: "Unidade", value: branch?.name ?? "" },
    { label: "Campanha", value: lead.sourceCampaign ?? "" },
    { label: "Chegou em", value: lead.createdAt ? dateTimeLabel(lead.createdAt) : "" },
    ...buildLeadClientInfo({
      telefone: lead.telefone,
      email: lead.email,
      tipo: lead.tipo,
      sourceChannel: lead.sourceChannel,
      sourceMetadata: lead.sourceMetadata,
      qualificationDetails: lead.qualificationDetails,
      formData: lead.formData,
    }).map((item) => ({ label: item.label.replace(/:$/, ""), value: item.value })),
  ].filter((row) => row.value.trim());

  const brokerRows: ConversationExportRow[] | null = broker ? [
    { label: "Nome", value: broker.name ?? "" },
    { label: "Telefone", value: broker.phone ?? "" },
    { label: "E-mail", value: broker.email ?? "" },
    { label: "Recebeu o lead em", value: lead.assignedAt ? dateTimeLabel(lead.assignedAt) : "" },
  ].filter((row) => row.value.trim()) : null;

  const messages = recentMessages.reverse().map((message) => ({
    sentAt: message.sentAt,
    sender: conversationSenderLabel(message.direction, message.senderRole),
    channel: conversationChannelLabel(message.provider),
    side: message.direction === "outgoing" || message.direction === "outbound" ? "out" as const : "in" as const,
    body: conversationMessageBody(message),
  }));

  return {
    tenantName: tenant?.name ?? "Empresa",
    logoUrl: tenant?.logoUrl ?? null,
    generatedAt: now,
    generatedBy: exporter?.name ?? "usuário",
    leadName: lead.nome,
    lead: leadRows,
    broker: brokerRows,
    messages,
    truncatedFrom: total > messages.length ? total : null,
  };
}
