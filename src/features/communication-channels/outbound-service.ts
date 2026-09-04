import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, ne, or } from "drizzle-orm";
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
import { sendWahaRelayMessage } from "@/features/waha-cadence/relay-client";
import { BROKER_LEAD_NOTIFICATION_INTERVAL_MS } from "@/features/notifications/broker-lead-cadence";
import { getInternalBrokerNotificationPolicy, getSelectedInternalWahaNumber, isInternalBrokerNotice } from "./internal-notification-policy";

const phoneSchema = z.string().trim().transform((value) => value.replace(/\D/g, "")).pipe(z.string().min(10).max(15));
const variablesSchema = z.array(z.string().trim().min(1).max(512)).max(10).default([]);

export const whatsappOutboundStatusValues = ["pending", "queued", "processing", "sent", "delivered", "read", "failed", "cancelled", "expired"] as const;
export type WhatsAppOutboundStatus = (typeof whatsappOutboundStatusValues)[number];

type DeliveryRoute = "meta_only" | "meta_then_waha" | "waha_direct";

export function selectInternalBrokerDeliveryRoute(input: {
  enabled: boolean;
  deliveryMode: "meta_then_waha" | "waha_direct";
  configuredWahaNumberId: string | null;
  activeWahaNumberId: string | null;
}): { route: DeliveryRoute; wahaNumberId: string | null } {
  if (!input.enabled) return { route: "meta_only", wahaNumberId: null };
  if (input.deliveryMode === "waha_direct") {
    return { route: "waha_direct", wahaNumberId: input.configuredWahaNumberId };
  }
  if (!input.activeWahaNumberId) return { route: "meta_only", wahaNumberId: null };
  return { route: "meta_then_waha", wahaNumberId: input.activeWahaNumberId };
}

async function resolveInternalBrokerDeliveryRoute(input: { tenantId: string; recipientType: string; purpose: string }) {
  if (!isInternalBrokerNotice(input)) return { route: "meta_only" as const, wahaNumberId: null };
  const policy = await getInternalBrokerNotificationPolicy(input.tenantId);
  const selected = await getSelectedInternalWahaNumber(input.tenantId, policy.wahaNumberId);
  // Preserve the director's explicit choice. A paused or unavailable direct
  // number is blocked later by the outbox instead of silently changing channel.
  return selectInternalBrokerDeliveryRoute({
    enabled: policy.enabled,
    deliveryMode: policy.deliveryMode,
    configuredWahaNumberId: policy.wahaNumberId,
    activeWahaNumberId: selected?.id ?? null,
  });
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
  const [lead] = await getDatabase().select({ id: schema.leads.id })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.id, leadId),
      eq(schema.leads.tenantId, row.tenantId),
      eq(schema.leads.corretorId, row.recipientId),
    ))
    .limit(1);
  return Boolean(lead);
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
  const resolvedTemplate = await WhatsAppTemplateResolver.resolveTemplateForEvent(input.tenantId, input.purpose);
  const template = resolvedTemplate ?? getMetaWhatsAppTemplate(input.purpose);
  if (!template) throw new Error("Modelo de WhatsApp não permitido para esta operação.");
  const db = getDatabase();
  const [existing] = await db.select().from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, status: existing.status as WhatsAppOutboundStatus, duplicate: true };
  const delivery = await resolveInternalBrokerDeliveryRoute(input);
  const channelQuery = input.channelId
    ? and(eq(schema.communicationChannels.id, input.channelId), eq(schema.communicationChannels.tenantId, input.tenantId))
    : and(
        eq(schema.communicationChannels.tenantId, input.tenantId),
        inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
        eq(schema.communicationChannels.status, "active"),
      );
  const [channel] = delivery.route === "waha_direct"
    ? []
    : await db.select({ id: schema.communicationChannels.id })
        .from(schema.communicationChannels)
        .where(channelQuery)
        .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt))
        .limit(1);
  if (delivery.route !== "waha_direct" && !channel) throw new Error("Nenhum canal corporativo ativo foi configurado.");
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.whatsappOutboundMessages).values({
    id, tenantId: input.tenantId, channelId: channel?.id ?? null, deliveryRoute: delivery.route, wahaNumberId: delivery.wahaNumberId, recipientType: input.recipientType, recipientId: input.recipientId ?? null,
    destinationPhone, purpose: input.purpose, messageType: "template", templateName: template.name, templateLanguage: template.language, variables,
    status: input.scheduledAt && input.scheduledAt > now ? "pending" : "queued", idempotencyKey: input.idempotencyKey,
    scheduledAt: input.scheduledAt ?? null, queuedAt: now, requestedBy: input.requestedBy ?? null, createdAt: now, updatedAt: now,
  });
  if (input.requestedBy) {
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.requestedBy, entidade: "whatsapp_outbound_message", entidadeId: id, acao: "whatsapp_message_queued" });
  }
  return { id, status: "queued" as const, duplicate: false };
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
  const delivery = await resolveInternalBrokerDeliveryRoute({
    tenantId: input.tenantId,
    recipientType: input.recipientType,
    purpose: input.purpose ?? "directText",
  });
  const channelQuery = input.channelId
    ? and(eq(schema.communicationChannels.id, input.channelId), eq(schema.communicationChannels.tenantId, input.tenantId))
    : and(
        eq(schema.communicationChannels.tenantId, input.tenantId),
        inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
        eq(schema.communicationChannels.status, "active"),
      );
  const [channel] = delivery.route === "waha_direct"
    ? []
    : await db.select({ id: schema.communicationChannels.id })
        .from(schema.communicationChannels)
        .where(channelQuery)
        .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt))
        .limit(1);
  if (delivery.route !== "waha_direct" && !channel) throw new Error("Nenhum canal corporativo ativo foi configurado.");
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
    const leadId = urlButtonParameter || split.urlButtonParameter;
    const link = leadId ? `\n\n👉 *Abrir conversa:* ${baseUrl}/conversas?lead=${leadId}` : "";
    return `✅ *Atribuição Confirmada*\n\nOlá *${brokerName}*, você assumiu o atendimento de *${leadNome}*.\n\n📞 *Telefone:* ${leadPhone}\n📋 *Tipo:* ${leadType}\n🏥 *Interesse:* ${interesse}\n👥 *Dependentes:* ${dependentes}${link}`;
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

export async function findActiveWahaFallbackNumber(tenantId: string, branchId?: string | null, capability: "brokerFallback" | "qualificationFallback" = "brokerFallback") {
  const db = getDatabase();
  const numbers = await db
    .select({
      id: schema.wahaNumbers.id,
      relaySessionId: schema.wahaNumbers.relaySessionId,
      displayPhoneNumber: schema.wahaNumbers.displayPhoneNumber,
      capabilities: schema.wahaNumbers.capabilities,
      status: schema.wahaNumbers.status,
    })
    .from(schema.wahaNumbers)
    .where(
      and(
        eq(schema.wahaNumbers.tenantId, tenantId),
        inArray(schema.wahaNumbers.status, ["WORKING", "active", "ready", "CONNECTED"]),
        ...(branchId ? [or(eq(schema.wahaNumbers.branchId, branchId), isNull(schema.wahaNumbers.branchId))] : []),
      ),
    )
    .orderBy(desc(schema.wahaNumbers.updatedAt))
    .limit(5);

  return numbers.find((n) => n.capabilities?.[capability] !== false) ?? null;
}

type WahaDeliveryRow = {
  id: string;
  tenantId: string;
  wahaNumberId: string | null;
  idempotencyKey: string;
  destinationPhone: string;
  messageType: string;
  variables: unknown;
  purpose: string;
  attempts: number;
};

async function sendSelectedWahaInternalNotice(row: WahaDeliveryRow, mode: "direct" | "fallback") {
  const number = await getSelectedInternalWahaNumber(row.tenantId, row.wahaNumberId);
  if (!number) {
    const error = new Error("O número WAHA selecionado para avisos internos está pausado ou indisponível.") as Error & { code?: string };
    error.code = "WAHA_INTERNAL_NUMBER_UNAVAILABLE";
    throw error;
  }
  const variables = Array.isArray(row.variables) ? row.variables.filter((value): value is string => typeof value === "string") : [];
  const body = row.messageType === "text" ? variables[0] ?? "" : resolveTemplateTextBody(row.purpose, variables);
  console.info("[waha_internal_outbound] sending notice", {
    outboundId: row.id,
    mode,
    relaySessionId: number.relaySessionId,
  });
  const sent = await sendWahaRelayMessage({
    idempotencyKey: `waha-${mode}-${row.id}-${row.attempts}`,
    sessionId: number.relaySessionId,
    destination: row.destinationPhone,
    body,
  });
  const now = new Date();
  const db = getDatabase();
  await db.update(schema.whatsappOutboundMessages).set({
    status: "sent",
    providerMessageId: sent.messageId,
    providerErrorCode: null,
    providerErrorMessage: mode === "direct" ? "Enviado diretamente pelo WAHA interno." : "Enviado pela contingência WAHA interna.",
    sentAt: now,
    failedAt: null,
    nextAttemptAt: null,
    updatedAt: now,
  }).where(and(eq(schema.whatsappOutboundMessages.id, row.id), eq(schema.whatsappOutboundMessages.tenantId, row.tenantId)));

  return sent;
}

/** Used by the Meta delivery webhook after a persisted internal notice is refused. */
export async function dispatchWahaFallbackAfterMetaDeliveryFailure(outboundId: string, tenantId: string) {
  const db = getDatabase();
  const [claimed] = await db.update(schema.whatsappOutboundMessages).set({ status: "processing", updatedAt: new Date() }).where(and(
    eq(schema.whatsappOutboundMessages.id, outboundId),
    eq(schema.whatsappOutboundMessages.tenantId, tenantId),
    eq(schema.whatsappOutboundMessages.deliveryRoute, "meta_then_waha"),
    eq(schema.whatsappOutboundMessages.status, "failed"),
  )).returning({
    id: schema.whatsappOutboundMessages.id,
    tenantId: schema.whatsappOutboundMessages.tenantId,
    wahaNumberId: schema.whatsappOutboundMessages.wahaNumberId,
    idempotencyKey: schema.whatsappOutboundMessages.idempotencyKey,
    destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
    messageType: schema.whatsappOutboundMessages.messageType,
    variables: schema.whatsappOutboundMessages.variables,
    purpose: schema.whatsappOutboundMessages.purpose,
    attempts: schema.whatsappOutboundMessages.attempts,
  });
  if (!claimed) return false;
  try {
    await sendSelectedWahaInternalNotice(claimed, "fallback");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 240) : "Falha no fallback WAHA interno.";
    await db.update(schema.whatsappOutboundMessages).set({ status: "failed", providerErrorMessage: message, failedAt: new Date(), updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, claimed.id));
    return false;
  }
}

export async function processMetaOutboundBatch(limit = 10, tenantId?: string, outboundId?: string): Promise<{ processed: number; sent: number; failed: number; retried: number }> {
  const db = getDatabase();
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 50);
  const now = new Date();
  const rows = await db.select().from(schema.whatsappOutboundMessages).where(and(
    tenantId ? eq(schema.whatsappOutboundMessages.tenantId, tenantId) : undefined,
    outboundId ? eq(schema.whatsappOutboundMessages.id, outboundId) : undefined,
    or(eq(schema.whatsappOutboundMessages.status, "queued"), eq(schema.whatsappOutboundMessages.status, "pending")),
    or(isNull(schema.whatsappOutboundMessages.providerErrorCode), ne(schema.whatsappOutboundMessages.providerErrorCode, "WAHA_INTERNAL_NUMBER_UNAVAILABLE")),
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

      if (row.deliveryRoute === "waha_direct") {
        try {
          await sendSelectedWahaInternalNotice({ ...row, attempts: row.attempts + 1 }, "direct");
          sent += 1;
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 240) : "Número WAHA interno indisponível.";
          const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code ?? "WAHA_DIRECT_SEND_FAILED") : "WAHA_DIRECT_SEND_FAILED";
          await db.update(schema.whatsappOutboundMessages).set({
            status: "pending",
            attempts: row.attempts,
            nextAttemptAt: null,
            providerErrorCode: code,
            providerErrorMessage: message,
            updatedAt: new Date(),
          }).where(eq(schema.whatsappOutboundMessages.id, row.id));
          failed += 1;
        }
        return;
      }

      if (row.purpose === "brokerInvitation" && row.recipientId) {
        const [loadedInvitation] = await db.select({ tokenCiphertext: schema.brokerInvitations.tokenCiphertext, expiresAt: schema.brokerInvitations.expiresAt, status: schema.brokerInvitations.status }).from(schema.brokerInvitations).where(and(eq(schema.brokerInvitations.id, row.recipientId), eq(schema.brokerInvitations.tenantId, row.tenantId))).limit(1);
        invitation = loadedInvitation;
        const invitationKey = process.env.INVITATION_TOKEN_ENCRYPTION_KEY?.trim() || process.env.META_WHATSAPP_TOKEN_ENCRYPTION_KEY?.trim();
        if (invitation?.tokenCiphertext && invitationKey) {
          try {
            urlButtonParameter = decryptChannelSecret(invitation.tokenCiphertext, invitationKey);
          } catch {
            urlButtonParameter = row.recipientId;
          }
        } else {
          urlButtonParameter = row.recipientId;
        }
      } else if (row.purpose === "leadAssignmentConfirmed") {
        const variables = Array.isArray(row.variables) ? row.variables.filter((value): value is string => typeof value === "string") : [];
        if (variables[6]) {
          urlButtonParameter = variables[6];
        }
      }

      if (!row.channelId) throw new Error("Canal Meta ausente para este envio.");
      const [channel] = await db.select().from(schema.communicationChannels).where(and(
        eq(schema.communicationChannels.id, row.channelId),
        eq(schema.communicationChannels.tenantId, row.tenantId),
        inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
        eq(schema.communicationChannels.status, "active"),
      )).limit(1);
      if (!channel?.phoneNumberId || !channel.accessTokenCiphertext) throw new Error("Canal corporativo incompleto.");
      const phoneNumberId = channel.phoneNumberId;
      const accessToken = decryptChannelSecret(channel.accessTokenCiphertext, getMetaCloudServerConfig().tokenEncryptionKey);

      let metaResponse: { messages?: Array<{ id: string }> } = {};
      if (row.messageType === "text") {
        const bodyText = Array.isArray(row.variables) && typeof row.variables[0] === "string" ? row.variables[0] : "";
        metaResponse = await sendMetaCloudText({ phoneNumberId, accessToken, to: row.destinationPhone, body: bodyText });
      } else {
        const variableNames = getMetaWhatsAppTemplateVariableNames(row.purpose);
        const rawVariables = Array.isArray(row.variables) ? row.variables.filter((value): value is string => typeof value === "string") : [];
        const templateVariables = splitMetaWhatsAppTemplateVariables(row.purpose, rawVariables);
        urlButtonParameter ??= templateVariables.urlButtonParameter;
        try {
          metaResponse = await sendMetaCloudTemplate({
            phoneNumberId,
            accessToken,
            to: row.destinationPhone,
            templateName: row.templateName,
            languageCode: row.templateLanguage,
            variables: templateVariables.bodyVariables,
            variableNames,
            urlButtonParameter,
          });
        } catch (templateError) {
          let sentWithFallback = false;
          if (variableNames) {
            try {
              metaResponse = await sendMetaCloudTemplate({
                phoneNumberId,
                accessToken,
                to: row.destinationPhone,
                templateName: row.templateName,
                languageCode: row.templateLanguage,
                variables: templateVariables.bodyVariables,
                variableNames: undefined,
                urlButtonParameter,
              });
              sentWithFallback = true;
            } catch {
              // Prosegue para fallback de idioma se falhar
            }
          }
          if (!sentWithFallback) {
            const isLanguageError = templateError instanceof MetaCloudApiError && (templateError.code === 100 || templateError.message.toLowerCase().includes("language") || templateError.message.toLowerCase().includes("does not exist"));
            if (isLanguageError) {
              const fallbackLangs = row.templateLanguage.startsWith("pt") ? ["en", "en_US"] : ["pt_BR"];
              for (const lang of fallbackLangs) {
                try {
                  metaResponse = await sendMetaCloudTemplate({
                    phoneNumberId,
                    accessToken,
                    to: row.destinationPhone,
                    templateName: row.templateName,
                    languageCode: lang,
                    variables: templateVariables.bodyVariables,
                    variableNames,
                    urlButtonParameter,
                  });
                  sentWithFallback = true;
                  break;
                } catch {
                  // Tenta próximo idioma de fallback
                }
              }
              if (!sentWithFallback) throw templateError;
            } else {
              throw templateError;
            }
          }
        }
      }

      const providerMessageId = metaResponse.messages?.[0]?.id || "wamid_sent";
      await db.update(schema.whatsappOutboundMessages).set({ status: "sent", providerMessageId, providerErrorCode: null, providerErrorMessage: null, sentAt: new Date(), updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
      if (invitation && row.recipientId) {
        await db.update(schema.brokerInvitations).set({ deliveryStatus: "sent", deliveryAttempts: row.attempts, deliveryError: null }).where(eq(schema.brokerInvitations.id, row.recipientId));
      }
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no envio via Meta Cloud API.";
      const code = error instanceof MetaCloudApiError ? String(error.code ?? error.status) : "META_OUTBOUND_FAILED";

      if (row.deliveryRoute === "waha_direct") {
        const nextAttemptAt = row.attempts < 3 ? new Date(Date.now() + Math.pow(2, row.attempts) * 60 * 1000) : null;
        await db.update(schema.whatsappOutboundMessages).set({
          status: nextAttemptAt ? "pending" : "failed",
          providerErrorCode: "WAHA_INTERNAL_FAILED",
          providerErrorMessage: message.slice(0, 240),
          nextAttemptAt,
          failedAt: nextAttemptAt ? null : new Date(),
          updatedAt: new Date(),
        }).where(eq(schema.whatsappOutboundMessages.id, row.id));
        if (nextAttemptAt) retried += 1; else failed += 1;
        return;
      }

      let sentViaWaha = false;
      try {
        const capability = (row.purpose === "aiQualification" || row.purpose === "leadQualification" || row.purpose === "lead_qualification")
          ? "qualificationFallback"
          : "brokerFallback";
        const wahaFallbackNumber = row.deliveryRoute === "meta_then_waha"
          ? await getSelectedInternalWahaNumber(row.tenantId, row.wahaNumberId)
          : await findActiveWahaFallbackNumber(row.tenantId, null, capability);
        if (wahaFallbackNumber) {
          const bodyText = row.messageType === "text"
            ? (Array.isArray(row.variables) && typeof row.variables[0] === "string" ? row.variables[0] : "")
            : resolveTemplateTextBody(row.purpose, Array.isArray(row.variables) ? row.variables.filter((v): v is string => typeof v === "string") : [], urlButtonParameter);

          const wahaRes = await sendWahaRelayMessage({
            idempotencyKey: `waha-fallback-${row.id}-${row.attempts}`,
            sessionId: wahaFallbackNumber.relaySessionId,
            destination: row.destinationPhone,
            body: bodyText,
          });

          const providerMessageId = wahaRes.messageId || "waha_fallback_sent";
          await db.update(schema.whatsappOutboundMessages).set({
            status: "sent",
            providerMessageId,
            providerErrorCode: null,
            providerErrorMessage: "Enviado via contingência WAHA",
            sentAt: new Date(),
            updatedAt: new Date(),
          }).where(eq(schema.whatsappOutboundMessages.id, row.id));

          if (invitation && row.recipientId) {
            await db.update(schema.brokerInvitations).set({ deliveryStatus: "sent", deliveryAttempts: row.attempts, deliveryError: null }).where(eq(schema.brokerInvitations.id, row.recipientId));
          }
          sent += 1;
          sentViaWaha = true;
        }
      } catch (wahaError) {
        console.warn("[meta-outbox] WAHA fallback attempt failed:", wahaError);
      }

      if (!sentViaWaha) {
        const nextAttemptAt = row.attempts < 3 ? new Date(Date.now() + Math.pow(2, row.attempts) * 60 * 1000) : null;
        const finalStatus: WhatsAppOutboundStatus = nextAttemptAt ? "pending" : "failed";
        await db.update(schema.whatsappOutboundMessages).set({ status: finalStatus, providerErrorCode: code, providerErrorMessage: message, nextAttemptAt, failedAt: nextAttemptAt ? null : new Date(), updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
        if (row.purpose === "brokerInvitation" && row.recipientId) {
          const failureUpdate = getInvitationDeliveryFailureUpdate({ shouldRetry: Boolean(nextAttemptAt), attempts: row.attempts });
          await db.update(schema.brokerInvitations).set(failureUpdate).where(eq(schema.brokerInvitations.id, row.recipientId));
        }
        if (nextAttemptAt) retried += 1; else failed += 1;
      }
    }
  };

  const brokerLeadRows = rows.filter((row) => row.purpose === "brokerLeadNotification");
  const otherRows = rows.filter((row) => row.purpose !== "brokerLeadNotification");
  await runWithConcurrency(otherRows, 3, processRow);
  for (const row of brokerLeadRows) await processRow(row);
  return { processed: rows.length, sent, failed, retried };
}
