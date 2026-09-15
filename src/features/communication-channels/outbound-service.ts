import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, lte, ne, or } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { decryptChannelSecret } from "./secret-crypto";
import { MetaCloudApiError, sendMetaCloudTemplate, sendMetaCloudText } from "./meta-cloud-client";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { getMetaWhatsAppTemplate, getMetaWhatsAppTemplateVariableNames, splitMetaWhatsAppTemplateVariables, type MetaWhatsAppTemplatePurpose } from "./templates";
import { META_CLOUD_PROVIDER } from "./types";
import { runWithConcurrency } from "@/shared/async/run-with-concurrency";
import { isWithinBusinessHours, scheduleForBusinessHours } from "@/shared/time/business-hours";
import { WhatsAppTemplateResolver } from "./template-sync-service";
import { BROKER_LEAD_NOTIFICATION_INTERVAL_MS } from "@/features/notifications/broker-lead-cadence";
import { isCustomerServiceWindowOpen, resolveEventMessagePlan } from "./message-policy-service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { resolveSystemUserId } from "@/shared/tenant/system-user";

const phoneSchema = z.string().trim().transform((value) => value.replace(/\D/g, "")).pipe(z.string().min(10).max(15));
const variablesSchema = z.array(z.string().trim().min(1).max(512)).max(10).default([]);

export const whatsappOutboundStatusValues = ["pending", "queued", "processing", "sent", "delivered", "read", "failed", "cancelled", "expired"] as const;
export type WhatsAppOutboundStatus = (typeof whatsappOutboundStatusValues)[number];

export const META_OUTBOUND_STALE_AFTER_HOURS_SETTING = "whatsapp_outbox_stale_after_hours";
export const DEFAULT_META_OUTBOUND_STALE_AFTER_HOURS = 24;
const MAX_META_OUTBOUND_STALE_AFTER_HOURS = 168;

export function parseMetaOutboundStaleAfterHours(value: string | undefined) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= MAX_META_OUTBOUND_STALE_AFTER_HOURS
    ? parsed
    : DEFAULT_META_OUTBOUND_STALE_AFTER_HOURS;
}

async function getMetaOutboundStaleAfterHours() {
  const configured = await getSystemSetting(META_OUTBOUND_STALE_AFTER_HOURS_SETTING).catch(() => undefined);
  return parseMetaOutboundStaleAfterHours(configured ?? process.env.META_OUTBOUND_STALE_AFTER_HOURS);
}

async function cancelStaleMetaOutboundRows(tenantId: string | undefined, now: Date) {
  const staleAfterHours = await getMetaOutboundStaleAfterHours();
  const cutoff = new Date(now.getTime() - staleAfterHours * 60 * 60 * 1000);
  const db = getDatabase();
  const staleRows = await db.select({ id: schema.whatsappOutboundMessages.id, tenantId: schema.whatsappOutboundMessages.tenantId })
    .from(schema.whatsappOutboundMessages)
    .where(and(
      tenantId ? eq(schema.whatsappOutboundMessages.tenantId, tenantId) : undefined,
      inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
      lt(schema.whatsappOutboundMessages.createdAt, cutoff),
    ))
    .orderBy(asc(schema.whatsappOutboundMessages.createdAt))
    .limit(200);

  let cancelled = 0;
  for (const row of staleRows) {
    const [updated] = await db.update(schema.whatsappOutboundMessages).set({
      status: "cancelled",
      providerErrorCode: "STALE_OUTBOX_MESSAGE",
      providerErrorMessage: `Mensagem pendente há mais de ${staleAfterHours}h; cancelada para evitar envio tardio.`,
      failedAt: now,
      updatedAt: now,
    }).where(and(
      eq(schema.whatsappOutboundMessages.id, row.id),
      eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
      inArray(schema.whatsappOutboundMessages.status, ["queued", "pending"]),
    )).returning({ id: schema.whatsappOutboundMessages.id });
    if (!updated) continue;
    cancelled += 1;
    const systemUserId = await resolveSystemUserId(row.tenantId);
    await db.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: systemUserId,
      entidade: "whatsapp_outbound_message",
      entidadeId: row.id,
      acao: "whatsapp_message_stale_cancelled",
      createdAt: now,
    });
  }
  if (cancelled > 0) {
    console.info("[meta-outbox] stale_messages_cancelled", { tenantId: tenantId ?? "global", cancelled, staleAfterHours });
  }
  return cancelled;
}

type DeliveryRoute = "meta_only" | "meta_then_waha" | "waha_direct";

export function selectInternalBrokerDeliveryRoute(input: {
  enabled: boolean;
  deliveryMode: "meta_then_waha" | "waha_direct";
  configuredWahaNumberId: string | null;
  activeWahaNumberId: string | null;
  messageType?: "template" | "text";
}): { route: DeliveryRoute; wahaNumberId: string | null } {
  void input;
  return { route: "meta_only", wahaNumberId: null };
}

function resolveInternalBrokerDeliveryRoute(input: { tenantId: string; recipientType: string; purpose: string }) {
  void input;
  return { route: "meta_only" as const, wahaNumberId: null };
}

export function getInvitationDeliveryFailureUpdate(input: { shouldRetry: boolean; attempts: number }) {
  const deliveryStatus: "queued" | "failed" = input.shouldRetry ? "queued" : "failed";
  return {
    deliveryStatus,
    deliveryAttempts: input.attempts,
    deliveryError: input.shouldRetry
      ? "Tentativa de envio será repetida automaticamente."
      : "A Meta não confirmou o envio do convite. Revise o template aprovado e o número antes de reenviar.",
  };
}

const terminalBrokerInvitationErrorCodes = new Set([
  "BROKER_INVITATION_NOT_FOUND",
  "BROKER_INVITATION_NOT_PENDING",
  "BROKER_INVITATION_EXPIRED",
  "BROKER_INVITATION_TOKEN_UNAVAILABLE",
  "BROKER_INVITATION_TOKEN_DECRYPT_FAILED",
]);

function brokerInvitationError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

async function isCurrentBrokerLeadNotification(row: {
  tenantId: string;
  purpose: string;
  recipientId: string | null;
  variables: unknown;
}) {
  if (row.purpose !== "brokerLeadNotification") return true;
  const leadId = Array.isArray(row.variables) && typeof row.variables[4] === "string"
    ? row.variables[4]
    : null;
  if (!leadId || !row.recipientId) return false;
  const [lead] = await getDatabase().select({ id: schema.leads.id, status: schema.leads.status, deletedAt: schema.leads.deletedAt, nome: schema.leads.nome })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, row.tenantId),
      eq(schema.leads.corretorId, row.recipientId),
      isNull(schema.leads.deletedAt),
    ))
    .limit(1);
  return Boolean(lead && lead.status !== "lost" && !/^Lead WhatsApp\s*\(/i.test(lead.nome?.trim() ?? ""));
}

async function isCurrentLeadOffer(row: {
  id: string;
  tenantId: string;
  purpose: string;
}, now: Date) {
  if (row.purpose !== "newLeadAssignment") return true;
  const [offer] = await getDatabase().select({
    status: schema.leadOffers.status,
    expiresAt: schema.leadOffers.expiresAt,
  }).from(schema.leadOffers).where(and(
    eq(schema.leadOffers.tenantId, row.tenantId),
    eq(schema.leadOffers.outboundMessageId, row.id),
  )).limit(1);
  // The manual-assignment notification reuses the same approved Meta
  // template but is not backed by a leadOffers row. Only linked offer rows
  // require the active-offer guard below.
  if (!offer) return true;
  return Boolean(
    ["PENDING", "SENT", "DELIVERED", "READ"].includes(offer.status)
      && offer.expiresAt > now,
  );
}

async function getBrokerLeadNotificationCadenceAt(row: {
  id: string;
  tenantId: string;
  purpose: string;
  recipientId: string | null;
}, now: Date) {
  if (row.purpose !== "brokerLeadNotification" || !row.recipientId) return null;
  const [previous] = await getDatabase().select({ sentAt: schema.whatsappOutboundMessages.sentAt })
    .from(schema.whatsappOutboundMessages)
    .where(and(
      eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
      eq(schema.whatsappOutboundMessages.recipientId, row.recipientId),
      eq(schema.whatsappOutboundMessages.purpose, "brokerLeadNotification"),
      ne(schema.whatsappOutboundMessages.id, row.id),
      inArray(schema.whatsappOutboundMessages.status, ["sent", "delivered", "read"]),
      isNotNull(schema.whatsappOutboundMessages.sentAt),
    ))
    .orderBy(desc(schema.whatsappOutboundMessages.sentAt))
    .limit(1);
  if (!previous?.sentAt) return null;
  const nextAllowedAt = new Date(previous.sentAt.getTime() + BROKER_LEAD_NOTIFICATION_INTERVAL_MS);
  return nextAllowedAt > now ? scheduleForBusinessHours(nextAllowedAt) : null;
}

export async function enqueueMetaTemplateMessage(input: {
  tenantId: string;
  channelId?: string;
  recipientType: "lead" | "client" | "user";
  recipientId?: string;
  destinationPhone: string;
  purpose: MetaWhatsAppTemplatePurpose;
  variables?: string[];
  requestedBy?: string | null;
  idempotencyKey: string;
  scheduledAt?: Date;
}) {
  const destinationPhone = phoneSchema.parse(input.destinationPhone);
  const variables = variablesSchema.parse(input.variables ?? []);
  const messagePlan = await resolveEventMessagePlan({
    tenantId: input.tenantId,
    recipientType: input.recipientType,
    recipientId: input.recipientId,
    destinationPhone,
    purpose: input.purpose,
    variables,
  });
  const resolvedTemplate = messagePlan ? null : await WhatsAppTemplateResolver.resolveTemplateForEvent(input.tenantId, input.purpose);
  const template = resolvedTemplate ?? getMetaWhatsAppTemplate(input.purpose);
  const primary = messagePlan?.primary ?? (template ? {
    type: "template" as const,
    templateName: template.name,
    templateLanguage: template.language,
  } : null);
  if (!primary) throw new Error("Modelo de WhatsApp não permitido para esta operação.");
  const db = getDatabase();
  const [existing] = await db.select().from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, status: existing.status as WhatsAppOutboundStatus, duplicate: true };
  const delivery = resolveInternalBrokerDeliveryRoute(input);
  const channelQuery = and(
    input.channelId ? eq(schema.communicationChannels.id, input.channelId) : undefined,
    eq(schema.communicationChannels.tenantId, input.tenantId),
    inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
    eq(schema.communicationChannels.status, "active"),
  );
  const [channel] = await db.select({ id: schema.communicationChannels.id })
    .from(schema.communicationChannels)
    .where(channelQuery)
    .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt))
    .limit(1);
  if (!channel) throw new Error("Nenhum canal corporativo ativo foi configurado.");
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.whatsappOutboundMessages).values({
    id, tenantId: input.tenantId, channelId: channel?.id ?? null, deliveryRoute: delivery.route, wahaNumberId: delivery.wahaNumberId, recipientType: input.recipientType, recipientId: input.recipientId ?? null,
    destinationPhone,
    purpose: input.purpose,
    messageType: primary.type,
    templateName: primary.templateName,
    templateLanguage: primary.templateLanguage,
    variables,
    providerVariables: primary.providerVariables ?? null,
    templateVariableNames: primary.templateVariableNames ?? null,
    messagePolicyId: messagePlan?.policyId ?? null,
    messagePolicyVersion: messagePlan?.policyVersion ?? null,
    renderedBody: primary.renderedBody ?? null,
    fallbackMessageType: messagePlan?.fallback?.type ?? null,
    fallbackTemplateName: messagePlan?.fallback?.templateName ?? null,
    fallbackTemplateLanguage: messagePlan?.fallback?.templateLanguage ?? null,
    fallbackRenderedBody: messagePlan?.fallback?.renderedBody ?? null,
    fallbackProviderVariables: messagePlan?.fallback?.providerVariables ?? null,
    fallbackTemplateVariableNames: messagePlan?.fallback?.templateVariableNames ?? null,
    status: input.scheduledAt && input.scheduledAt > now ? "pending" : "queued", idempotencyKey: input.idempotencyKey,
    scheduledAt: input.scheduledAt ?? null, queuedAt: now, requestedBy: input.requestedBy ?? null, createdAt: now, updatedAt: now,
  });
  if (input.requestedBy) {
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.requestedBy, entidade: "whatsapp_outbound_message", entidadeId: id, acao: "whatsapp_message_queued" });
  }
  return { id, status: "queued" as const, duplicate: false };
}

/**
 * Persists and immediately attempts one configured event message.
 *
 * The outbox remains the source of truth: callers use this helper only when
 * the business flow needs the provider result before it can advance (for
 * example, the first qualification message).
 */
export async function enqueueAndProcessMetaEventMessage(
  input: Parameters<typeof enqueueMetaTemplateMessage>[0],
) {
  const queued = await enqueueMetaTemplateMessage(input);
  await processMetaOutboundBatch(1, input.tenantId, queued.id);
  const [message] = await getDatabase().select({
    id: schema.whatsappOutboundMessages.id,
    channelId: schema.whatsappOutboundMessages.channelId,
    status: schema.whatsappOutboundMessages.status,
    messageType: schema.whatsappOutboundMessages.messageType,
    renderedBody: schema.whatsappOutboundMessages.renderedBody,
    fallbackRenderedBody: schema.whatsappOutboundMessages.fallbackRenderedBody,
    providerMessageId: schema.whatsappOutboundMessages.providerMessageId,
    providerErrorCode: schema.whatsappOutboundMessages.providerErrorCode,
    providerErrorMessage: schema.whatsappOutboundMessages.providerErrorMessage,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.id, queued.id),
    eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
  )).limit(1);
  if (!message) throw new Error("Mensagem configurada não foi encontrada no outbox.");
  return message;
}

/** Queue a tenant-scoped text message through the protected outbox (supports Meta Cloud or WAHA Direct for team). */
export async function enqueueMetaTextMessage(input: {
  tenantId: string;
  channelId?: string;
  recipientType: "lead" | "client" | "user";
  recipientId?: string;
  destinationPhone: string;
  body: string;
  requestedBy?: string | null;
  idempotencyKey: string;
  scheduledAt?: Date;
  purpose?: string;
}) {
  const destinationPhone = phoneSchema.parse(input.destinationPhone);
  const body = z.string().trim().min(1).max(4096).parse(input.body);
  const db = getDatabase();
  const delivery = resolveInternalBrokerDeliveryRoute({
    tenantId: input.tenantId,
    recipientType: input.recipientType,
    purpose: input.purpose ?? "directText",
  });
  const channelQuery = and(
    input.channelId ? eq(schema.communicationChannels.id, input.channelId) : undefined,
    eq(schema.communicationChannels.tenantId, input.tenantId),
    inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
    eq(schema.communicationChannels.status, "active"),
  );
  const [channel] = await db.select({ id: schema.communicationChannels.id })
    .from(schema.communicationChannels)
    .where(channelQuery)
    .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt))
    .limit(1);
  if (!channel) throw new Error("Nenhum canal corporativo ativo foi configurado.");
  const [existing] = await db.select().from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, status: existing.status as WhatsAppOutboundStatus, duplicate: true };
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.whatsappOutboundMessages).values({
    id, tenantId: input.tenantId, channelId: channel?.id ?? null, deliveryRoute: delivery.route, wahaNumberId: delivery.wahaNumberId, recipientType: input.recipientType, recipientId: input.recipientId ?? null,
    destinationPhone, purpose: input.purpose ?? "directText", messageType: "text", templateName: "__text__", templateLanguage: "pt_BR", variables: [body],
    status: input.scheduledAt && input.scheduledAt > now ? "pending" : "queued", idempotencyKey: input.idempotencyKey,
    scheduledAt: input.scheduledAt ?? null, queuedAt: now, requestedBy: input.requestedBy ?? null, createdAt: now, updatedAt: now,
  });
  if (input.requestedBy) {
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.requestedBy, entidade: "whatsapp_outbound_message", entidadeId: id, acao: "whatsapp_message_queued" });
  }
  return { id, status: "queued" as const, duplicate: false };
}

export function resolveTemplateTextBody(purpose: string, rawVariables: string[], urlButtonParameter?: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://crm.ancorasaude.cloud";

  if (purpose === "brokerInvitation") {
    const nome = rawVariables[0]?.trim() || "Corretor(a)";
    const empresa = rawVariables[1]?.trim() || "Âncora";
    const link = urlButtonParameter
      ? (urlButtonParameter.startsWith("http") ? urlButtonParameter : `${baseUrl}/convite/${urlButtonParameter}`)
      : baseUrl;
    return `Olá *${nome}*! 👋\n\nVocê recebeu um convite para criar seu acesso no sistema *${empresa}*.\n\nAcesse o link abaixo para definir sua senha e entrar no sistema:\n${link}\n\n_Este link é individual e seguro._`;
  }

  if (purpose === "brokerLeadNotification") {
    const split = splitMetaWhatsAppTemplateVariables(purpose, rawVariables);
    const corretorNome = split.bodyVariables[1] || rawVariables[1] || "Corretor(a)";
    const leadNome = split.bodyVariables[2] || rawVariables[2] || "Cliente";
    const produto = split.bodyVariables[3] || rawVariables[3] || "Plano de saúde";
    const leadId = urlButtonParameter || split.urlButtonParameter;
    const link = leadId ? `\n\n👉 *Acesse no CRM:* ${baseUrl}/conversas?lead=${leadId}` : "";
    return `⚡ *Novo Lead Atribuído!*\n\nOlá *${corretorNome}*, um novo lead foi atribuído a você:\n\n👤 *Cliente:* ${leadNome}\n🏥 *Interesse:* ${produto}${link}`;
  }

  if (purpose === "leadAssignmentConfirmed") {
    const split = splitMetaWhatsAppTemplateVariables(purpose, rawVariables);
    const brokerName = split.bodyVariables[0] || rawVariables[0] || "Corretor(a)";
    const leadNome = split.bodyVariables[1] || rawVariables[1] || "Cliente";
    const leadPhone = split.bodyVariables[2] || rawVariables[2] || "";
    const interesse = split.bodyVariables[3] || rawVariables[3] || "Plano de Saúde";
    const leadType = split.bodyVariables[4] || rawVariables[4] || "Individual";
    const dependentes = split.bodyVariables[5] || rawVariables[5] || "0";
    const cidade = split.bodyVariables[6] || rawVariables[6] || "Não informada";
    const leadId = urlButtonParameter || split.urlButtonParameter;
    const link = leadId ? `\n\n👉 *Abrir conversa:* ${baseUrl}/conversas?lead=${leadId}` : "";
    return `✅ *Atribuição Confirmada*\n\nOlá *${brokerName}*, você assumiu o atendimento de *${leadNome}*.\n\n📞 *Telefone:* ${leadPhone}\n📋 *Tipo:* ${leadType}\n🏥 *Interesse:* ${interesse}\n👥 *Dependentes:* ${dependentes}\n📍 *Cidade:* ${cidade}${link}`;
  }

  if (purpose === "newLeadAssignment") {
    const split = splitMetaWhatsAppTemplateVariables(purpose, rawVariables);
    const brokerName = split.bodyVariables[0] || rawVariables[0] || "Corretor(a)";
    const leadType = split.bodyVariables[2] || rawVariables[2] || "Lead";
    const branchName = split.bodyVariables[3] || rawVariables[3] || "Unidade";
    const timeout = split.bodyVariables[4] || rawVariables[4] || "15";
    const leadId = urlButtonParameter || split.urlButtonParameter;
    const link = leadId ? `\n\n👉 *Aceitar Lead:* ${baseUrl}/conversas?lead=${leadId}` : "";
    return `🚨 *Novo Lead Disponível!*\n\nOlá *${brokerName}*, há um lead de *${leadType}* disponível em *${branchName}*.\n\n⏱️ Você tem *${timeout} minutos* para aceitar o atendimento.${link}`;
  }

  if (purpose === "taskReminder") {
    const nome = rawVariables[0] || "Usuário";
    const tarefa = rawVariables[1] || "Tarefa agendada";
    const dataHora = rawVariables[2] || "Hoje";
    return `⏰ *Lembrete de Tarefa*\n\nOlá *${nome}*, você tem uma tarefa pendente:\n📌 *${tarefa}*\n📅 *Horário:* ${dataHora}`;
  }

  if (purpose === "clientNotice") {
    const nome = rawVariables[0] || "Cliente";
    const msg = rawVariables[1] || "";
    return `📢 *Aviso Âncora CRM*\n\nOlá *${nome}*,\n\n${msg}`;
  }

  if (purpose === "leadQualification" || purpose === "lead_qualification") {
    const nome = rawVariables[0] || "Cliente";
    return `Olá *${nome}*! 👋\n\nSomos da equipe de atendimento. Como podemos te ajudar a encontrar o melhor plano de saúde hoje?`;
  }

  if (purpose === "leadAssignmentUnavailable") {
    const brokerName = rawVariables[0] || "Corretor(a)";
    return `ℹ️ *Aviso de Atribuição*\n\nOlá *${brokerName}*, este lead já foi atribuído a outro corretor ou expirou.`;
  }

  if (purpose === "leadAssignmentExpired") {
    const brokerName = rawVariables[0] || "Corretor(a)";
    return `⏳ *Tempo Expirado*\n\nOlá *${brokerName}*, o tempo para aceitar o lead expirou e a oportunidade foi repassada.`;
  }

  return rawVariables.filter(Boolean).join("\n") || "Notificação Âncora CRM";
}

export async function processMetaOutboundBatch(limit = 10, tenantId?: string, outboundId?: string): Promise<{ processed: number; sent: number; failed: number; retried: number }> {
  const db = getDatabase();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const now = new Date();
  // Exact dispatches are the latency-critical path for a newly offered lead.
  // Stale-row cleanup belongs to the cron/batch pass; doing it here could
  // walk and audit hundreds of old rows before the fresh message is sent.
  if (!outboundId) await cancelStaleMetaOutboundRows(tenantId, now);
  const rows = await db.select().from(schema.whatsappOutboundMessages).where(and(
    tenantId ? eq(schema.whatsappOutboundMessages.tenantId, tenantId) : undefined,
    outboundId ? eq(schema.whatsappOutboundMessages.id, outboundId) : undefined,
    or(eq(schema.whatsappOutboundMessages.status, "queued"), eq(schema.whatsappOutboundMessages.status, "pending")),
    or(lte(schema.whatsappOutboundMessages.scheduledAt, now), isNull(schema.whatsappOutboundMessages.scheduledAt)),
    or(lte(schema.whatsappOutboundMessages.nextAttemptAt, now), isNull(schema.whatsappOutboundMessages.nextAttemptAt)),
  )).orderBy(asc(schema.whatsappOutboundMessages.createdAt)).limit(safeLimit);
  let sent = 0;
  let failed = 0;
  let retried = 0;
  const processRow = async (row: (typeof rows)[number]) => {
    let urlButtonParameter: string | undefined;
    let invitation: { tokenCiphertext: string | null; expiresAt: Date; status: string } | undefined;
    const [claimed] = await db.update(schema.whatsappOutboundMessages).set({ status: "processing", attempts: row.attempts + 1, updatedAt: new Date() }).where(and(eq(schema.whatsappOutboundMessages.id, row.id), or(eq(schema.whatsappOutboundMessages.status, "queued"), eq(schema.whatsappOutboundMessages.status, "pending")))).returning({ id: schema.whatsappOutboundMessages.id });
    if (!claimed) return;
    try {
      if (row.deliveryRoute !== "meta_only" || row.wahaNumberId) {
        await db.update(schema.whatsappOutboundMessages).set({
          deliveryRoute: "meta_only",
          wahaNumberId: null,
          providerErrorCode: null,
          providerErrorMessage: "Envio corporativo migrado para a API oficial Meta.",
          updatedAt: new Date(),
        }).where(and(
          eq(schema.whatsappOutboundMessages.id, row.id),
          eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
        ));
      }
      if (row.purpose === "brokerLeadNotification" && !isWithinBusinessHours()) {
        await db.update(schema.whatsappOutboundMessages).set({
          status: "pending",
          attempts: row.attempts,
          scheduledAt: scheduleForBusinessHours(),
          nextAttemptAt: null,
          providerErrorCode: "OUTSIDE_BUSINESS_HOURS",
          providerErrorMessage: "Aviso de novo lead aguarda o próximo horário comercial.",
          updatedAt: new Date(),
        }).where(eq(schema.whatsappOutboundMessages.id, row.id));
        return;
      }
      const cadenceAt = await getBrokerLeadNotificationCadenceAt(row, now);
      if (cadenceAt) {
        await db.update(schema.whatsappOutboundMessages).set({
          status: "pending",
          attempts: row.attempts,
          scheduledAt: cadenceAt,
          nextAttemptAt: null,
          providerErrorCode: "BROKER_NOTIFICATION_CADENCE",
          providerErrorMessage: "Aviso de novo lead agendado para respeitar o intervalo do corretor.",
          updatedAt: new Date(),
        }).where(eq(schema.whatsappOutboundMessages.id, row.id));
        return;
      }
      if (!await isCurrentBrokerLeadNotification(row)) {
        await db.update(schema.whatsappOutboundMessages).set({
          status: "cancelled",
          providerErrorCode: "ASSIGNMENT_SUPERSEDED",
          providerErrorMessage: "A atribuição do lead foi alterada antes do envio.",
          updatedAt: new Date(),
        }).where(eq(schema.whatsappOutboundMessages.id, row.id));
        console.info("[meta-outbox] broker_notification_cancelled", {
          outboundMessageId: row.id,
          tenantId: row.tenantId,
          purpose: row.purpose,
        });
        return;
      }
      if (!await isCurrentLeadOffer(row, now)) {
        await db.update(schema.whatsappOutboundMessages).set({
          status: "cancelled",
          providerErrorCode: "OFFER_NO_LONGER_ACTIVE",
          providerErrorMessage: "A oferta não está mais ativa; envio cancelado.",
          updatedAt: new Date(),
        }).where(and(
          eq(schema.whatsappOutboundMessages.id, row.id),
          eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
        ));
        await db.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: await resolveSystemUserId(row.tenantId),
          entidade: "whatsapp_outbound_message",
          entidadeId: row.id,
          acao: "whatsapp_offer_message_cancelled_inactive",
          createdAt: new Date(),
        });
        console.info("[meta-outbox] lead_offer_cancelled_before_send", {
          outboundMessageId: row.id,
          tenantId: row.tenantId,
          purpose: row.purpose,
        });
        return;
      }

      if (row.purpose === "brokerInvitation" && row.recipientId) {
        const [loadedInvitation] = await db.select({ tokenCiphertext: schema.brokerInvitations.tokenCiphertext, expiresAt: schema.brokerInvitations.expiresAt, status: schema.brokerInvitations.status }).from(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.id, row.recipientId), eq(schema.brokerInvitations.tenantId, row.tenantId))).limit(1);
        invitation = loadedInvitation;
        if (!invitation) {
          throw brokerInvitationError("BROKER_INVITATION_NOT_FOUND", "Convite de primeiro acesso não encontrado.");
        }
        if (invitation.status !== "PENDING") {
          throw brokerInvitationError("BROKER_INVITATION_NOT_PENDING", "Convite de primeiro acesso não está mais pendente.");
        }
        if (invitation.expiresAt <= now) {
          throw brokerInvitationError("BROKER_INVITATION_EXPIRED", "Convite de primeiro acesso expirou antes do envio.");
        }
        const invitationKey = process.env.INVITATION_TOKEN_ENCRYPTION_KEY?.trim() || process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim();
        if (!invitation.tokenCiphertext || !invitationKey) {
          throw brokerInvitationError(
            "BROKER_INVITATION_TOKEN_UNAVAILABLE",
            "Token seguro do convite indisponível para entrega pelo WhatsApp.",
          );
        }
        try {
          urlButtonParameter = decryptChannelSecret(invitation.tokenCiphertext, invitationKey);
        } catch {
          throw brokerInvitationError(
            "BROKER_INVITATION_TOKEN_DECRYPT_FAILED",
            "Não foi possível recuperar o token seguro do convite para entrega.",
          );
        }
      } else if (row.purpose === "leadAssignmentConfirmed") {
        const variables = Array.isArray(row.variables) ? row.variables.filter((value): value is string => typeof value === "string") : [];
        if (variables[7]) {
          urlButtonParameter = variables[7];
        }
      }

      // Always resolve an active Meta channel. Legacy rows may point to a
      // removed WAHA channel, so that id must never make the migrated send
      // fail with a false "channel unavailable" error.
      const [channel] = await db.select().from(schema.communicationChannels).where(and(
        eq(schema.communicationChannels.tenantId, row.tenantId),
        inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
        eq(schema.communicationChannels.status, "active"),
      )).orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt)).limit(1);
      if (!channel?.phoneNumberId || !channel.accessTokenCiphertext) throw new Error("Canal corporativo incompleto.");
      if (row.channelId !== channel.id || row.deliveryRoute !== "meta_only" || row.wahaNumberId) {
        await db.update(schema.whatsappOutboundMessages).set({
          channelId: channel.id,
          deliveryRoute: "meta_only",
          wahaNumberId: null,
          updatedAt: new Date(),
        }).where(and(
          eq(schema.whatsappOutboundMessages.id, row.id),
          eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
        ));
      }
      const phoneNumberId = channel.phoneNumberId;
      const accessToken = decryptChannelSecret(channel.accessTokenCiphertext, getMetaCloudServerConfig().tokenEncryptionKey);

      const rawVariables = Array.isArray(row.variables)
        ? row.variables.filter((value): value is string => typeof value === "string")
        : [];
      const defaultTemplateVariables = splitMetaWhatsAppTemplateVariables(row.purpose, rawVariables);
      urlButtonParameter ??= defaultTemplateVariables.urlButtonParameter;
      const stringArray = (value: unknown) => Array.isArray(value)
        ? value.filter((item): item is string => typeof item === "string")
        : [];
      const sendTemplateResource = async (resource: {
        name: string;
        language: string;
        providerVariables?: unknown;
        variableNames?: unknown;
      }) => {
        const configuredVariables = stringArray(resource.providerVariables);
        const variables = configuredVariables.length > 0 ? configuredVariables : defaultTemplateVariables.bodyVariables;
        const configuredNames = stringArray(resource.variableNames);
        const variableNames = configuredNames.length > 0 ? configuredNames : getMetaWhatsAppTemplateVariableNames(row.purpose);
        try {
          return await sendMetaCloudTemplate({
            phoneNumberId, accessToken, to: row.destinationPhone,
            templateName: resource.name, languageCode: resource.language,
            variables, variableNames, urlButtonParameter,
          });
        } catch (templateError) {
          if (variableNames) {
            try {
              return await sendMetaCloudTemplate({
                phoneNumberId, accessToken, to: row.destinationPhone,
                templateName: resource.name, languageCode: resource.language,
                variables, variableNames: undefined, urlButtonParameter,
              });
            } catch {
              // Some migrated templates use positional parameters instead of named parameters.
            }
          }
          const isLanguageError = templateError instanceof MetaCloudApiError
            && (templateError.code === 100
              || templateError.message.toLowerCase().includes("language")
              || templateError.message.toLowerCase().includes("does not exist"));
          if (!isLanguageError) throw templateError;
          const fallbackLangs = resource.language.startsWith("pt") ? ["en", "en_US"] : ["pt_BR"];
          for (const languageCode of fallbackLangs) {
            try {
              return await sendMetaCloudTemplate({
                phoneNumberId, accessToken, to: row.destinationPhone,
                templateName: resource.name, languageCode,
                variables, variableNames, urlButtonParameter,
              });
            } catch {
              // The next language is attempted only before a provider accepts the message.
            }
          }
          throw templateError;
        }
      };

      let metaResponse: { messages?: Array<{ id: string }> };
      try {
        if (row.messageType === "text") {
          const bodyText = row.renderedBody ?? rawVariables[0] ?? "";
          metaResponse = await sendMetaCloudText({ phoneNumberId, accessToken, to: row.destinationPhone, body: bodyText });
        } else {
          metaResponse = await sendTemplateResource({
            name: row.templateName,
            language: row.templateLanguage,
            providerVariables: row.providerVariables,
            variableNames: row.templateVariableNames,
          });
        }
      } catch (primaryError) {
        let fallbackResponse: { messages?: Array<{ id: string }> } | null = null;
        try {
          if (row.fallbackMessageType === "template" && row.fallbackTemplateName) {
            fallbackResponse = await sendTemplateResource({
              name: row.fallbackTemplateName,
              language: row.fallbackTemplateLanguage ?? "pt_BR",
              providerVariables: row.fallbackProviderVariables,
              variableNames: row.fallbackTemplateVariableNames,
            });
          } else if (row.fallbackMessageType === "text" && row.fallbackRenderedBody) {
            const serviceWindowOpen = await isCustomerServiceWindowOpen({
              tenantId: row.tenantId,
              recipientType: row.recipientType as "lead" | "client" | "user",
              recipientId: row.recipientId ?? undefined,
              destinationPhone: row.destinationPhone,
            });
            if (serviceWindowOpen) {
              fallbackResponse = await sendMetaCloudText({
                phoneNumberId, accessToken, to: row.destinationPhone, body: row.fallbackRenderedBody,
              });
            }
          }
        } catch {
          // Preserve the original provider error for retry classification and diagnostics.
        }
        if (!fallbackResponse) throw primaryError;
        metaResponse = fallbackResponse;
      }

      const providerMessageId = metaResponse.messages?.[0]?.id || "wamid_sent";
      await db.update(schema.whatsappOutboundMessages).set({ status: "sent", providerMessageId, providerErrorCode: null, providerErrorMessage: null, sentAt: new Date(), updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
      // DEC-049: bind the provider wamid to the offer so a broker's button
      // reply can be resolved even when Meta omits `context.id`.
      if (row.purpose === "newLeadAssignment") {
        await db.update(schema.leadOffers).set({ whatsappMessageId: providerMessageId, updatedAt: new Date() }).where(and(
          eq(schema.leadOffers.outboundMessageId, row.id),
          eq(schema.leadOffers.tenantId, row.tenantId),
          isNull(schema.leadOffers.whatsappMessageId),
        ));
      }
      if (invitation && row.recipientId) {
        await db.update(schema.brokerInvitations).set({ deliveryStatus: "sent", deliveryAttempts: row.attempts + 1, deliveryError: null }).where(and(
          eq(schema.brokerInvitations.id, row.recipientId),
          eq(schema.brokerInvitations.tenantId, row.tenantId),
        ));
      }
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio via Meta Cloud API.";
      const code = error instanceof MetaCloudApiError
        ? String(error.code ?? error.status)
        : typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "META_OUTBOUND_FAILED")
          : "META_OUTBOUND_FAILED";
      const terminalInvitationFailure = row.purpose === "brokerInvitation" && terminalBrokerInvitationErrorCodes.has(code);

      const nextAttemptAt = !terminalInvitationFailure && row.attempts < 3
        ? new Date(Date.now() + Math.pow(2, row.attempts) * 60 * 1000)
        : null;
      const finalStatus: WhatsAppOutboundStatus = nextAttemptAt ? "pending" : "failed";
      await db.update(schema.whatsappOutboundMessages).set({ status: finalStatus, deliveryRoute: "meta_only", wahaNumberId: null, providerErrorCode: code, providerErrorMessage: message, nextAttemptAt, failedAt: nextAttemptAt ? null : new Date(), updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
      if (row.purpose === "brokerInvitation" && row.recipientId) {
        const failureUpdate = getInvitationDeliveryFailureUpdate({ shouldRetry: Boolean(nextAttemptAt), attempts: row.attempts + 1 });
        await db.update(schema.brokerInvitations).set({
          ...failureUpdate,
          deliveryError: terminalInvitationFailure ? message.slice(0, 240) : failureUpdate.deliveryError,
        }).where(and(
          eq(schema.brokerInvitations.id, row.recipientId),
          eq(schema.brokerInvitations.tenantId, row.tenantId),
        ));
      }
      if (nextAttemptAt) retried += 1; else failed += 1;
    }
  };

  const brokerLeadRows = rows.filter((row) => row.purpose === "brokerLeadNotification");
  const otherRows = rows.filter((row) => row.purpose !== "brokerLeadNotification");
  await runWithConcurrency(otherRows, 3, processRow);
  for (const row of brokerLeadRows) await processRow(row);
  return { processed: rows.length, sent, failed, retried };
}
