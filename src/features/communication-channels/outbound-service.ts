import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { getDatabase, schema } from "@/shared/db";
import { decryptChannelSecret } from "./secret-crypto";
import { MetaCloudApiError, sendMetaCloudTemplate, sendMetaCloudText } from "./meta-cloud-client";
import { companyChatUnavailableMessage } from "./meta-delivery-failure";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { getMetaWhatsAppTemplate, getMetaWhatsAppTemplateVariableNames, splitMetaWhatsAppTemplateVariables } from "./templates";
import { META_CLOUD_PROVIDER } from "./types";
import { runWithConcurrency } from "@/shared/async/run-with-concurrency";
import { WhatsAppTemplateResolver } from "./template-sync-service";
import { isCustomerServiceWindowOpen, resolveApprovedMetaEventTemplate, resolveEventMessagePlan } from "./message-policy-service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getFeatureFlag } from "@/features/system-settings/queries";
import { FEATURE_FLAGS } from "@/shared/feature-flags/catalog";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { resolveCanonicalWhatsAppDestination } from "./phone-resolution";
import { resolveNamedTemplateBodyParameters } from "./template-parameters";
import { getColdLeadReactivationAt, isEligibleColdLeadForReactivation } from "@/features/ai-qualification/cold-lead-reactivation-policy";
import { findConnectedTenantChannelId, TENANT_CHANNEL_CONNECTED_STATUSES } from "@/features/waha-cadence/tenant-channel-routing";
import { sendWahaRelayMessage } from "@/features/waha-cadence/relay-client";
import { BROKER_CHAT_NOTICE, teamNoticeByKey, teamNoticeForPurpose } from "@/features/team-notices/catalog";
import { companyNumberUsable, decideTeamNotice } from "@/features/team-notices/decision";
import { DELIVERY_LIMITS } from "@/features/team-notices/guard";
import { builtInNoticeVariants, localHour, type NoticeFields } from "@/features/team-notices/variants";
import {
  evaluateNoticeRow,
  getCompanyNumberState,
  getTeamNoticeSetting,
  recordCompanyNumberFailure,
  recordCompanyNumberSuccess,
  renderTeamNoticeText,
  reserveCompanyNumberSlot,
} from "@/features/team-notices/service";

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
      or(isNull(schema.whatsappOutboundMessages.scheduledAt), lte(schema.whatsappOutboundMessages.scheduledAt, cutoff)),
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

/** Configuration problems a retry cannot fix: the template must be approved/linked on the sending number first. */
const terminalTemplateErrorCodes = new Set(["TEMPLATE_NOT_IN_WABA", "TEMPLATE_PARAMETERS_UNAVAILABLE"]);

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

function stringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function outboundChannelError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

async function resolveMetaOutboundChannel(row: {
  tenantId: string;
  channelId: string | null;
  purpose: string;
}) {
  const db = getDatabase();
  const providerFilter = inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]);
  if (row.channelId) {
    const [boundChannel] = await db.select().from(schema.communicationChannels).where(and(
      eq(schema.communicationChannels.id, row.channelId),
      eq(schema.communicationChannels.tenantId, row.tenantId),
      providerFilter,
      eq(schema.communicationChannels.status, "active"),
    )).limit(1);
    if (boundChannel) return boundChannel;
    if (row.purpose === "brokerAccountActivated") {
      throw outboundChannelError(
        "BROKER_ACTIVATION_CHANNEL_UNAVAILABLE",
        "O canal usado no convite não está mais disponível; o aviso de ativação não será enviado por outro número.",
      );
    }
  } else if (row.purpose === "brokerAccountActivated") {
    throw outboundChannelError(
      "BROKER_ACTIVATION_CHANNEL_UNAVAILABLE",
      "O convite original não possui um canal corporativo vinculado; o aviso de ativação não será enviado por outro número.",
    );
  }

  const [fallbackChannel] = await db.select().from(schema.communicationChannels).where(and(
    eq(schema.communicationChannels.tenantId, row.tenantId),
    providerFilter,
    eq(schema.communicationChannels.status, "active"),
  )).orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt)).limit(1);
  return fallbackChannel ?? null;
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

async function isCurrentColdLeadReactivation(row: OutboundRow) {
  if (!row.idempotencyKey.startsWith("cold-lead-reactivation:") || row.purpose !== "leadQualification") return true;
  if (await getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION) !== "true") return false;
  const leadId = row.recipientId;
  if (!leadId) return false;
  const db = getDatabase();
  const [lead] = await db.select({
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationState: schema.leads.qualificationState,
    qualificationCompletedAt: schema.leads.qualificationCompletedAt,
    corretorId: schema.leads.corretorId,
    status: schema.leads.status,
    distributionStatus: schema.leads.distributionStatus,
    distributionRemovedAt: schema.leads.distributionRemovedAt,
    archivedAt: schema.leads.archivedAt,
    deletedAt: schema.leads.deletedAt,
  }).from(schema.leads).where(and(
    eq(schema.leads.id, leadId),
    eq(schema.leads.tenantId, row.tenantId),
  )).limit(1);
  if (!lead || !isEligibleColdLeadForReactivation(lead)) return false;
  const [rule] = await db.select({ enabled: schema.aiQualificationFollowUpRules.enabled })
    .from(schema.aiQualificationFollowUpRules).where(and(
      eq(schema.aiQualificationFollowUpRules.id, `cold-lead-reactivation:${row.tenantId}`),
      eq(schema.aiQualificationFollowUpRules.tenantId, row.tenantId),
      eq(schema.aiQualificationFollowUpRules.trigger, "cold_lead_reactivation"),
    )).limit(1);
  if (!rule?.enabled) return false;
  const [conversation] = await db.select({ optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt })
    .from(schema.aiConversations).where(and(
      eq(schema.aiConversations.tenantId, row.tenantId),
      eq(schema.aiConversations.leadId, leadId),
    )).limit(1);
  return !conversation?.optOutAt && !conversation?.wrongNumberAt;
}

async function isCurrentColdLeadAcknowledgement(row: OutboundRow) {
  if (!row.idempotencyKey.startsWith("cold-lead-reactivation-ack:") || row.purpose !== "coldLeadReactivationAcknowledgement") return true;
  if (await getFeatureFlag(FEATURE_FLAGS.COLD_LEAD_REACTIVATION) !== "true" || !row.recipientId) return false;
  const db = getDatabase();
  const [lead] = await db.select({
    qualificationStatus: schema.leads.qualificationStatus,
    corretorId: schema.leads.corretorId,
    deletedAt: schema.leads.deletedAt,
    archivedAt: schema.leads.archivedAt,
  }).from(schema.leads).where(and(
    eq(schema.leads.id, row.recipientId),
    eq(schema.leads.tenantId, row.tenantId),
  )).limit(1);
  if (!lead || lead.qualificationStatus !== "cold" || !lead.corretorId || lead.deletedAt || lead.archivedAt) return false;
  const [membership] = await db.select({ role: schema.tenantMemberships.role })
    .from(schema.tenantMemberships).where(and(
      eq(schema.tenantMemberships.tenantId, row.tenantId),
      eq(schema.tenantMemberships.userId, lead.corretorId),
      eq(schema.tenantMemberships.status, "active"),
    )).limit(1);
  if (membership?.role !== "broker") return false;
  const [conversation] = await db.select({ optOutAt: schema.aiConversations.optOutAt, wrongNumberAt: schema.aiConversations.wrongNumberAt })
    .from(schema.aiConversations).where(and(
      eq(schema.aiConversations.tenantId, row.tenantId),
      eq(schema.aiConversations.leadId, row.recipientId),
    )).limit(1);
  return !conversation?.optOutAt && !conversation?.wrongNumberAt;
}

async function deferColdLeadReactivationOutsideWindow(row: OutboundRow, now: Date) {
  if (!row.idempotencyKey.startsWith("cold-lead-reactivation:") || row.purpose !== "leadQualification" || !row.recipientId) return false;
  const [lead] = await getDatabase().select({ qualificationCompletedAt: schema.leads.qualificationCompletedAt })
    .from(schema.leads).where(and(
      eq(schema.leads.id, row.recipientId),
      eq(schema.leads.tenantId, row.tenantId),
    )).limit(1);
  if (!lead?.qualificationCompletedAt) return false;
  const scheduledAt = getColdLeadReactivationAt(lead.qualificationCompletedAt, now);
  if (scheduledAt <= now) return false;
  await getDatabase().update(schema.whatsappOutboundMessages).set({
    status: "pending",
    scheduledAt,
    holdReason: "cold_lead_business_window",
    updatedAt: now,
  }).where(and(
    eq(schema.whatsappOutboundMessages.id, row.id),
    eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
    eq(schema.whatsappOutboundMessages.status, "processing"),
  ));
  return true;
}

export async function enqueueMetaTemplateMessage(input: {
  tenantId: string;
  channelId?: string;
  recipientType: "lead" | "client" | "user";
  recipientId?: string;
  destinationPhone: string;
  purpose: string;
  variables?: string[];
  requestedBy?: string | null;
  idempotencyKey: string;
  scheduledAt?: Date;
  /** Never use text or an unapproved legacy name for this governed event. */
  requireApprovedMetaTemplate?: boolean;
}) {
  const requestedDestinationPhone = phoneSchema.parse(input.destinationPhone);
  const destinationPhone = await resolveCanonicalWhatsAppDestination({
    tenantId: input.tenantId,
    phone: requestedDestinationPhone,
    leadId: input.recipientType === "lead" ? input.recipientId : null,
  }) ?? requestedDestinationPhone;
  const variables = variablesSchema.parse(input.variables ?? []);
  // Resolved up front: a template only exists inside the sending number's
  // WhatsApp Business Account, so the lookup below is scoped to its WABA.
  const channelQuery = and(
    input.channelId ? eq(schema.communicationChannels.id, input.channelId) : undefined,
    eq(schema.communicationChannels.tenantId, input.tenantId),
    inArray(schema.communicationChannels.provider, [META_CLOUD_PROVIDER, "meta_cloud_api", "meta_cloud"]),
    eq(schema.communicationChannels.status, "active"),
    input.requireApprovedMetaTemplate ? isNull(schema.communicationChannels.branchId) : undefined,
  );
  const [channel] = await getDatabase().select({ id: schema.communicationChannels.id, wabaId: schema.communicationChannels.wabaId })
    .from(schema.communicationChannels)
    .where(channelQuery)
    .orderBy(desc(schema.communicationChannels.isDefault), desc(schema.communicationChannels.createdAt))
    .limit(1);
  if (input.requireApprovedMetaTemplate && !channel) {
    throw outboundChannelError("META_CHANNEL_UNAVAILABLE", "Não existe um canal oficial da Meta ativo para este tenant.");
  }
  const messagePlan = input.requireApprovedMetaTemplate
    ? await resolveApprovedMetaEventTemplate({ tenantId: input.tenantId, purpose: input.purpose, variables })
    : input.purpose === "dutyPresenceConfirmation" ? null : await resolveEventMessagePlan({
      tenantId: input.tenantId,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      destinationPhone,
      purpose: input.purpose,
      variables,
    });
  if (input.requireApprovedMetaTemplate && messagePlan?.primary.type !== "template") {
    throw outboundChannelError("FIRST_CONTACT_TEMPLATE_UNAVAILABLE", "Não existe template FIRST_CONTACT aprovado e vinculado à WABA ativa deste tenant.");
  }
  // Activation notices are allowed to use only the governed event plan or a
  // synchronized approved resource. Do not let the generic legacy resolver
  // invent a template name when an active policy is incomplete.
  const resolvedTemplate = input.requireApprovedMetaTemplate || messagePlan || input.purpose === "brokerAccountActivated"
    ? null
    : await WhatsAppTemplateResolver.resolveTemplateForEvent(input.tenantId, input.purpose, channel?.wabaId ?? null);
  const template = input.requireApprovedMetaTemplate ? null : resolvedTemplate ?? (input.purpose === "brokerAccountActivated" || input.purpose === "dutyPresenceConfirmation" ? null : getMetaWhatsAppTemplate(input.purpose));
  // Team notices (DEC-125): one decision per notice. Disabled means not sent
  // (kept as 'skipped'); company number first falls back to the Meta resource
  // resolved above; Meta first keeps the company number as its fallback.
  const teamNotice = input.recipientType === "user" ? teamNoticeForPurpose(input.purpose) : null;
  let noticeRoute: { route: DeliveryRoute; wahaNumberId: string | null; text: string | null; variant?: string; skipped: boolean; note: string | null } | null = null;
  // Rotation seed: the idempotency key, so a re-enqueue of the same notice keeps its text.
  const noticeText = (setting: Parameters<typeof renderTeamNoticeText>[0]["setting"]) => renderTeamNoticeText({
    tenantId: input.tenantId, notice: teamNotice!, setting, variables,
    builtIn: resolveNoticeTextVariants(input.purpose, variables), seed: input.idempotencyKey, recipientId: input.recipientId ?? null,
  });
  if (teamNotice) {
    const [setting, number] = await Promise.all([getTeamNoticeSetting(input.tenantId, teamNotice), getCompanyNumberState(input.tenantId)]);
    const decision = decideTeamNotice(teamNotice, setting, number, new Date());
    if (decision.action === "skip") {
      noticeRoute = { route: "meta_only", wahaNumberId: null, text: null, skipped: true, note: "disabled" };
    } else if (decision.primary === "company_number") {
      const rendered = await noticeText(setting);
      noticeRoute = rendered
        ? { route: "waha_direct", wahaNumberId: decision.wahaNumberId, text: rendered.text, variant: rendered.variant, skipped: false, note: null }
        : { route: "meta_only", wahaNumberId: null, text: null, skipped: false, note: "empty_company_text" };
    } else {
      noticeRoute = decision.wahaNumberId
        ? { route: "meta_then_waha", wahaNumberId: decision.wahaNumberId, text: null, skipped: false, note: decision.note }
        : { route: "meta_only", wahaNumberId: null, text: null, skipped: false, note: decision.note };
    }
  }
  // Only a team notice set to the company WhatsApp goes through WAHA; every
  // other broker message follows the official Meta channel.
  const tenantChannel = noticeRoute?.route === "waha_direct" && noticeRoute.wahaNumberId && noticeRoute.text
    ? { wahaNumberId: noticeRoute.wahaNumberId, text: noticeRoute.text }
    : null;
  if (noticeRoute?.skipped) {
    const db = getDatabase();
    const [existing] = await db.select().from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, input.idempotencyKey))).limit(1);
    if (existing) return { id: existing.id, status: existing.status as WhatsAppOutboundStatus, duplicate: true };
    const id = randomUUID();
    const now = new Date();
    await db.insert(schema.whatsappOutboundMessages).values({
      id, tenantId: input.tenantId, channelId: channel?.id ?? null, deliveryRoute: "meta_only", wahaNumberId: null,
      recipientType: input.recipientType, recipientId: input.recipientId ?? null, destinationPhone, purpose: input.purpose,
      messageType: "text", templateName: "__skipped__", templateLanguage: "pt_BR", variables,
      status: "skipped", holdReason: "disabled", noticeKey: teamNotice!.key, idempotencyKey: input.idempotencyKey,
      queuedAt: now, requestedBy: input.requestedBy ?? null, createdAt: now, updatedAt: now,
    });
    return { id, status: "skipped" as WhatsAppOutboundStatus, duplicate: false };
  }
  const primary = messagePlan?.primary ?? (template ? {
    type: "template" as const,
    templateName: template.name,
    templateLanguage: template.language,
  } : tenantChannel ? {
    type: "text" as const,
    templateName: "__text__",
    templateLanguage: "pt_BR",
    renderedBody: tenantChannel.text,
  } : null);
  if (!primary && noticeRoute?.route === "meta_then_waha") {
    // Meta has nothing approved for this notice: the company number carries it.
    const rendered = await noticeText(await getTeamNoticeSetting(input.tenantId, teamNotice!));
    if (rendered) noticeRoute = { route: "waha_direct", wahaNumberId: noticeRoute.wahaNumberId, text: rendered.text, variant: rendered.variant, skipped: false, note: "meta_template_missing" };
  }
  const primaryResolved = primary ?? (noticeRoute?.route === "waha_direct" && noticeRoute.text
    ? { type: "text" as const, templateName: "__text__", templateLanguage: "pt_BR", renderedBody: noticeRoute.text }
    : null);
  if (!primaryResolved) throw new Error("Modelo de WhatsApp não permitido para esta operação.");
  const db = getDatabase();
  const [existing] = await db.select().from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, status: existing.status as WhatsAppOutboundStatus, duplicate: true };
  const delivery = resolveInternalBrokerDeliveryRoute(input);
  if (!channel && !tenantChannel && !noticeRoute?.wahaNumberId) throw new Error("Nenhum canal corporativo ativo foi configurado.");
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.whatsappOutboundMessages).values({
    id, tenantId: input.tenantId, channelId: channel?.id ?? null,
    deliveryRoute: noticeRoute ? noticeRoute.route : tenantChannel ? "waha_direct" : delivery.route,
    holdReason: noticeRoute?.note ?? null,
    textVariant: noticeRoute?.route === "waha_direct" ? noticeRoute.variant ?? null : null,
    wahaNumberId: noticeRoute ? noticeRoute.wahaNumberId : tenantChannel?.wahaNumberId ?? delivery.wahaNumberId,
    noticeKey: teamNotice?.key ?? null,
    recipientType: input.recipientType, recipientId: input.recipientId ?? null,
    destinationPhone,
    purpose: input.purpose,
    messageType: primaryResolved.type,
    templateName: primaryResolved.templateName,
    templateLanguage: primaryResolved.templateLanguage,
    variables,
    providerVariables: primaryResolved.providerVariables ?? null,
    templateVariableNames: primaryResolved.templateVariableNames ?? null,
    messagePolicyId: messagePlan?.policyId ?? null,
    messagePolicyVersion: messagePlan?.policyVersion ?? null,
    renderedBody: (noticeRoute?.route === "waha_direct" ? noticeRoute.text : null) ?? tenantChannel?.text ?? primaryResolved.renderedBody ?? null,
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

/** The company WAHA number when it can send now (connected and not paused by the breaker). */
async function usableCompanyNumber(tenantId: string): Promise<{ id: string | null; pausedUntil: Date | null }> {
  const id = await findConnectedTenantChannelId(tenantId);
  if (!id) return { id: null, pausedUntil: null };
  const [number] = await getDatabase().select({ pausedUntil: schema.wahaNumbers.pausedUntil }).from(schema.wahaNumbers).where(eq(schema.wahaNumbers.id, id)).limit(1);
  const pausedUntil = number?.pausedUntil && number.pausedUntil > new Date() ? number.pausedUntil : null;
  return { id: pausedUntil ? null : id, pausedUntil };
}

/** Whether the broker wrote to an official number in the last 24h (Meta's free-text window). */
export async function brokerMetaWindowOpen(tenantId: string, phone: string) {
  const suffix = phone.replace(/\D/g, "").slice(-8);
  if (suffix.length < 8) return false;
  const [message] = await getDatabase().select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages).where(and(
    eq(schema.whatsappMessages.tenantId, tenantId),
    inArray(schema.whatsappMessages.provider, [META_CLOUD_PROVIDER, "meta"]),
    inArray(schema.whatsappMessages.direction, ["incoming", "inbound"]),
    gte(schema.whatsappMessages.sentAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
    sql`RIGHT(REGEXP_REPLACE(${schema.whatsappMessages.phone}, '[^0-9]', '', 'g'), 8) = ${suffix}`,
  )).limit(1);
  return Boolean(message);
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
  const requestedDestinationPhone = phoneSchema.parse(input.destinationPhone);
  const destinationPhone = await resolveCanonicalWhatsAppDestination({
    tenantId: input.tenantId,
    phone: requestedDestinationPhone,
    leadId: input.recipientType === "lead" ? input.recipientId : null,
  }) ?? requestedDestinationPhone;
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
  // Free text to a broker follows the "Mensagens do chat" choice: the company
  // WhatsApp when it is connected (Meta otherwise), or the official Meta only.
  const chatSetting = input.recipientType === "user" ? await getTeamNoticeSetting(input.tenantId, BROKER_CHAT_NOTICE).catch(() => null) : null;
  const chatViaCompany = chatSetting?.channel === "company_number";
  const company = chatViaCompany ? await usableCompanyNumber(input.tenantId).catch(() => ({ id: null, pausedUntil: null })) : null;
  const tenantChannelId = company?.id ?? null;
  // The chat was set to the company WhatsApp and it is down: Meta only
  // delivers free text inside the broker's 24h window, so outside it the
  // message is refused with the reason instead of failing at Meta.
  if (chatViaCompany && !tenantChannelId && !(await brokerMetaWindowOpen(input.tenantId, destinationPhone))) {
    throw new Error(companyChatUnavailableMessage(company?.pausedUntil ?? null));
  }
  if (!channel && !tenantChannelId) throw new Error("Nenhum canal corporativo ativo foi configurado.");
  const [existing] = await db.select().from(schema.whatsappOutboundMessages).where(and(eq(schema.whatsappOutboundMessages.tenantId, input.tenantId), eq(schema.whatsappOutboundMessages.idempotencyKey, input.idempotencyKey))).limit(1);
  if (existing) return { id: existing.id, status: existing.status as WhatsAppOutboundStatus, duplicate: true };
  const id = randomUUID();
  const now = new Date();
  await db.insert(schema.whatsappOutboundMessages).values({
    id, tenantId: input.tenantId, channelId: channel?.id ?? null,
    deliveryRoute: tenantChannelId ? "waha_direct" : delivery.route, wahaNumberId: tenantChannelId ?? delivery.wahaNumberId,
    ...(tenantChannelId ? { renderedBody: body } : {}),
    recipientType: input.recipientType, recipientId: input.recipientId ?? null,
    destinationPhone, purpose: input.purpose ?? "directText", messageType: "text", templateName: "__text__", templateLanguage: "pt_BR", variables: [body],
    status: input.scheduledAt && input.scheduledAt > now ? "pending" : "queued", idempotencyKey: input.idempotencyKey,
    scheduledAt: input.scheduledAt ?? null, queuedAt: now, requestedBy: input.requestedBy ?? null, createdAt: now, updatedAt: now,
  });
  if (input.requestedBy) {
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: input.requestedBy, entidade: "whatsapp_outbound_message", entidadeId: id, acao: "whatsapp_message_queued" });
  }
  return { id, status: "queued" as const, duplicate: false };
}

function textBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.APP_URL?.trim() || "https://crm.ancorasaude.cloud";
}

/** The values a team notice's text shows, read from the outbox variables (same order as the Meta template). */
function noticeTextFields(purpose: string, rawVariables: string[], urlButtonParameter?: string): NoticeFields | null {
  const baseUrl = textBaseUrl();
  if (purpose === "brokerAccountActivated") {
    return {
      purpose,
      name: rawVariables[0]?.trim() || "Corretor(a)",
      company: rawVariables[1]?.trim() || "Âncora",
      loginUrl: rawVariables[2]?.trim() || process.env.CRM_LOGIN_URL?.trim() || "https://crm.ancorasaude.cloud/login",
    };
  }
  if (purpose === "brokerLeadNotification" || purpose === "newLeadAssignment") {
    const split = splitMetaWhatsAppTemplateVariables(purpose, rawVariables);
    const leadId = urlButtonParameter || split.urlButtonParameter;
    return {
      purpose,
      broker: split.bodyVariables[1] || rawVariables[1] || "Corretor(a)",
      lead: split.bodyVariables[2] || rawVariables[2] || "Cliente",
      product: split.bodyVariables[3] || rawVariables[3] || "Plano de saúde",
      link: leadId ? `${baseUrl}/leads/${leadId}` : null,
    };
  }
  if (purpose === "leadAssignmentConfirmed") {
    const split = splitMetaWhatsAppTemplateVariables(purpose, rawVariables);
    const leadId = urlButtonParameter || split.urlButtonParameter;
    return {
      purpose,
      broker: split.bodyVariables[0] || rawVariables[0] || "Corretor(a)",
      lead: split.bodyVariables[1] || rawVariables[1] || "Cliente",
      phone: split.bodyVariables[2] || rawVariables[2] || "",
      interest: split.bodyVariables[3] || rawVariables[3] || "Plano de Saúde",
      leadType: split.bodyVariables[4] || rawVariables[4] || "Individual",
      dependents: split.bodyVariables[5] || rawVariables[5] || "0",
      city: split.bodyVariables[6] || rawVariables[6] || "Não informada",
      link: leadId ? `${baseUrl}/conversas?lead=${leadId}` : null,
    };
  }
  if (purpose === "taskReminder") {
    return { purpose, name: rawVariables[0] || "Usuário", task: rawVariables[1] || "Tarefa agendada", when: rawVariables[2] || "Hoje" };
  }
  if (purpose === "leadAssignmentUnavailable" || purpose === "leadAssignmentExpired") {
    return { purpose, broker: rawVariables[0] || "Corretor(a)" };
  }
  if (purpose === "dutyPresenceConfirmation") {
    const confirmationId = urlButtonParameter || rawVariables[2]?.trim() || "";
    return {
      purpose,
      broker: rawVariables[0]?.trim() || "Corretor(a)",
      hour: rawVariables[1]?.trim() || "",
      link: confirmationId ? `${baseUrl}/confirm_presence?id=${confirmationId}` : null,
    };
  }
  if (purpose === "leadFeedbackReminder") {
    return { purpose, broker: rawVariables[0]?.trim() || "Corretor(a)", lead: rawVariables[1]?.trim() || "seu lead" };
  }
  return null;
}

export function resolveTemplateTextBody(purpose: string, rawVariables: string[], urlButtonParameter?: string): string {
  const baseUrl = textBaseUrl();

  if (purpose === "brokerInvitation") {
    const nome = rawVariables[0]?.trim() || "Corretor(a)";
    const empresa = rawVariables[1]?.trim() || "Âncora";
    const link = urlButtonParameter
      ? (urlButtonParameter.startsWith("http") ? urlButtonParameter : `${baseUrl}/convite/${urlButtonParameter}`)
      : baseUrl;
    return `Olá *${nome}*! 👋\n\nVocê recebeu um convite para criar seu acesso no sistema *${empresa}*.\n\nAcesse o link abaixo para definir sua senha e entrar no sistema:\n${link}\n\n_Este link é individual e seguro._`;
  }

  // Team notices: the original wording is version 0 of the rotation.
  const fields = noticeTextFields(purpose, rawVariables, urlButtonParameter);
  if (fields) return builtInNoticeVariants(fields, 12)[0]!;

  if (purpose === "clientNotice") {
    const nome = rawVariables[0] || "Cliente";
    const msg = rawVariables[1] || "";
    return `📢 *Aviso Âncora CRM*\n\nOlá *${nome}*,\n\n${msg}`;
  }

  if (purpose === "leadQualification" || purpose === "lead_qualification") {
    const nome = rawVariables[0] || "Cliente";
    return `Olá *${nome}*! 👋\n\nSomos da equipe de atendimento. Como podemos te ajudar a encontrar o melhor plano de saúde hoje?`;
  }

  return rawVariables.filter(Boolean).join("\n") || "Notificação Âncora CRM";
}

/**
 * Every built-in wording of a team notice for the company number (rotation
 * against identical runs); other purposes have only their single text.
 */
export function resolveNoticeTextVariants(purpose: string, rawVariables: string[], now = new Date()): string[] {
  const fields = noticeTextFields(purpose, rawVariables);
  return fields ? builtInNoticeVariants(fields, localHour(now)) : [resolveTemplateTextBody(purpose, rawVariables)];
}

type OutboundRow = typeof schema.whatsappOutboundMessages.$inferSelect;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Applies the delivery guard to a team notice row. "held": back to the queue
 * with the reason and when to retry; "dropped": skipped for good (stale
 * reminder, duplicate, daily reminder limit). An exact dispatch (a fresh lead
 * notice) waits a few seconds inline instead of a whole cron cycle.
 */
async function guardNoticeRow(row: OutboundRow, channel: "company_number" | "meta", exact: boolean): Promise<"go" | "held" | "dropped"> {
  const db = getDatabase();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const verdict = await evaluateNoticeRow({ ...row, noticeKey: row.noticeKey! }, channel);
    if (verdict.kind === "now") return "go";
    if (verdict.kind === "drop") {
      await db.update(schema.whatsappOutboundMessages).set({ status: "skipped", holdReason: verdict.reason, updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
      return "dropped";
    }
    const waitMs = verdict.until.getTime() - Date.now();
    if (exact && attempt === 0 && waitMs <= 15_000) {
      await sleep(Math.max(waitMs, 0));
      continue;
    }
    await db.update(schema.whatsappOutboundMessages).set({ status: "queued", attempts: row.attempts, nextAttemptAt: verdict.until, holdReason: verdict.reason, updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
    return "held";
  }
  return "go";
}

/** A presence confirmation sent by the company number counts as notified, as on the Meta path. */
async function markPresenceNotified(row: OutboundRow) {
  if (row.purpose !== "dutyPresenceConfirmation" || !Array.isArray(row.variables) || typeof row.variables[2] !== "string") return;
  await getDatabase().update(schema.dutyPresenceConfirmations).set({ notificationStatus: "sent", notificationErrorCode: null, updatedAt: new Date() }).where(and(
    eq(schema.dutyPresenceConfirmations.id, row.variables[2]),
    eq(schema.dutyPresenceConfirmations.tenantId, row.tenantId),
  ));
}

/** Takes the company number's spacing slot; an exact dispatch retries once after the gap. */
async function takeCompanySlot(wahaNumberId: string, noticeKey: string, exact: boolean) {
  const critical = teamNoticeByKey(noticeKey)?.class === "critical";
  const gapMs = critical ? DELIVERY_LIMITS.companyNumber.criticalGapMs : DELIVERY_LIMITS.companyNumber.gapMs;
  if (await reserveCompanyNumberSlot(wahaNumberId, gapMs)) return true;
  if (!exact) return false;
  await sleep(gapMs);
  return reserveCompanyNumberSlot(wahaNumberId, gapMs);
}

/** Company-number fallback for a team notice Meta could not send. True when it went out. */
async function sendNoticeByCompanyNumber(row: OutboundRow, metaError: unknown, exact: boolean) {
  const notice = teamNoticeByKey(row.noticeKey!);
  if (!notice || notice.metaOnly) return false;
  const db = getDatabase();
  const [number] = await db.select({ id: schema.wahaNumbers.id, relaySessionId: schema.wahaNumbers.relaySessionId, status: schema.wahaNumbers.status, pausedUntil: schema.wahaNumbers.pausedUntil })
    .from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.id, row.wahaNumberId!), eq(schema.wahaNumbers.tenantId, row.tenantId))).limit(1);
  const now = new Date();
  if (!number || !companyNumberUsable({ id: number.id, connected: TENANT_CHANNEL_CONNECTED_STATUSES.includes(number.status), pausedUntil: number.pausedUntil }, now).usable) return false;
  const variables = stringList(row.variables);
  const rendered = await renderTeamNoticeText({
    tenantId: row.tenantId, notice, setting: await getTeamNoticeSetting(row.tenantId, notice), variables,
    builtIn: resolveNoticeTextVariants(row.purpose, variables), seed: row.idempotencyKey, recipientId: row.recipientId,
  });
  if (!rendered) return false;
  const text = rendered.text;
  if (!await takeCompanySlot(number.id, notice.key, exact)) return false;
  try {
    const sentByWaha = await sendWahaRelayMessage({ idempotencyKey: `${row.idempotencyKey}:company`, sessionId: number.relaySessionId, destination: row.destinationPhone.replace(/\D/g, ""), body: text, humanize: true });
    const reason = metaError instanceof Error ? metaError.message.slice(0, 120) : "Meta indisponível";
    await db.update(schema.whatsappOutboundMessages).set({
      status: "sent", deliveryRoute: "waha_direct", renderedBody: text, textVariant: rendered.variant, providerMessageId: sentByWaha.messageId,
      providerErrorCode: null, providerErrorMessage: `Meta não enviou (${reason}); enviado pelo WhatsApp da empresa.`,
      holdReason: null, sentAt: now, updatedAt: now,
    }).where(eq(schema.whatsappOutboundMessages.id, row.id));
    await recordCompanyNumberSuccess(number.id).catch(() => undefined);
    await markPresenceNotified(row);
    return true;
  } catch {
    await recordCompanyNumberFailure(number.id).catch(() => undefined);
    return false;
  }
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
      // A notice routed to the company number (WhatsApp da diretoria) keeps
      // its WAHA route; every other non-Meta row is legacy and migrates.
      const viaTenantChannel = row.deliveryRoute === "waha_direct" && Boolean(row.wahaNumberId) && Boolean(row.renderedBody);
      // Rows queued before "Meta" became Meta only may still carry the company number as fallback.
      const companyFallback = row.deliveryRoute === "meta_then_waha" && Boolean(row.wahaNumberId) && Boolean(row.noticeKey);
      if (!viaTenantChannel && !companyFallback && (row.deliveryRoute !== "meta_only" || row.wahaNumberId)) {
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
      if (!await isCurrentColdLeadReactivation(row)) {
        await db.update(schema.whatsappOutboundMessages).set({
          status: "cancelled",
          providerErrorCode: "COLD_LEAD_REACTIVATION_NO_LONGER_ELIGIBLE",
          providerErrorMessage: "O lead não está mais elegível; reativação cancelada antes do envio.",
          updatedAt: new Date(),
        }).where(and(eq(schema.whatsappOutboundMessages.id, row.id), eq(schema.whatsappOutboundMessages.tenantId, row.tenantId)));
        await db.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: await resolveSystemUserId(row.tenantId),
          entidade: "whatsapp_outbound_message",
          entidadeId: row.id,
          acao: "cold_lead_reactivation.cancelled_not_eligible",
          createdAt: new Date(),
        });
        return;
      }
      if (!await isCurrentColdLeadAcknowledgement(row)) {
        await db.update(schema.whatsappOutboundMessages).set({
          status: "cancelled",
          providerErrorCode: "COLD_LEAD_ACK_NO_LONGER_ELIGIBLE",
          providerErrorMessage: "O lead não está mais atribuído a um corretor; aviso cancelado.",
          updatedAt: new Date(),
        }).where(and(eq(schema.whatsappOutboundMessages.id, row.id), eq(schema.whatsappOutboundMessages.tenantId, row.tenantId)));
        await db.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: await resolveSystemUserId(row.tenantId),
          entidade: "whatsapp_outbound_message",
          entidadeId: row.id,
          acao: "cold_lead_reactivation.ack_cancelled_not_assigned_to_broker",
          createdAt: new Date(),
        });
        return;
      }
      if (await deferColdLeadReactivationOutsideWindow(row, new Date())) return;

      // Delivery guard (DEC-125): business hours, spacing and limits for team notices.
      if (row.noticeKey) {
        const verdict = await guardNoticeRow(row, viaTenantChannel ? "company_number" : "meta", Boolean(outboundId));
        if (verdict === "held") return;
        if (verdict === "dropped") return;
      }

      if (viaTenantChannel) {
        const [tenantNumber] = await db.select({ relaySessionId: schema.wahaNumbers.relaySessionId, pausedUntil: schema.wahaNumbers.pausedUntil }).from(schema.wahaNumbers)
          .where(and(
            eq(schema.wahaNumbers.id, row.wahaNumberId!),
            eq(schema.wahaNumbers.tenantId, row.tenantId),
            inArray(schema.wahaNumbers.status, TENANT_CHANNEL_CONNECTED_STATUSES),
          ))
          .limit(1);
        try {
          if (!tenantNumber) throw new Error("Número da empresa desconectado.");
          if (tenantNumber.pausedUntil && tenantNumber.pausedUntil > new Date()) throw new Error("Número da empresa pausado após falhas seguidas.");
          if (row.noticeKey && !await takeCompanySlot(row.wahaNumberId!, row.noticeKey, Boolean(outboundId))) {
            await db.update(schema.whatsappOutboundMessages).set({ status: "queued", attempts: row.attempts, nextAttemptAt: new Date(Date.now() + 5_000), holdReason: "number_spacing", updatedAt: new Date() })
              .where(eq(schema.whatsappOutboundMessages.id, row.id));
            return;
          }
          const sentByWaha = await sendWahaRelayMessage({
            idempotencyKey: row.idempotencyKey,
            sessionId: tenantNumber.relaySessionId,
            destination: row.destinationPhone.replace(/\D/g, ""),
            body: row.renderedBody!,
            humanize: true,
          });
          await db.update(schema.whatsappOutboundMessages).set({ status: "sent", providerMessageId: sentByWaha.messageId, providerErrorCode: null, providerErrorMessage: null, holdReason: null, sentAt: new Date(), updatedAt: new Date() })
            .where(eq(schema.whatsappOutboundMessages.id, row.id));
          await recordCompanyNumberSuccess(row.wahaNumberId!).catch(() => undefined);
          await markPresenceNotified(row);
          sent += 1;
          return;
        } catch (wahaError) {
          await recordCompanyNumberFailure(row.wahaNumberId!).catch(() => undefined);
          if (!row.noticeKey && row.recipientType === "user" && !(await brokerMetaWindowOpen(row.tenantId, row.destinationPhone))) {
            await db.update(schema.whatsappOutboundMessages).set({
              status: "failed",
              failedAt: new Date(),
              providerErrorCode: "COMPANY_NUMBER_UNAVAILABLE",
              providerErrorMessage: companyChatUnavailableMessage(null),
              updatedAt: new Date(),
            }).where(eq(schema.whatsappOutboundMessages.id, row.id));
            return;
          }
          // Never lose the notice: fall back to the Meta resource on the row.
          console.warn("[tenant-channel] waha_send_failed_falling_back_to_meta", {
            outboundMessageId: row.id,
            purpose: row.purpose,
            error: wahaError instanceof Error ? wahaError.message.slice(0, 160) : "unknown",
          });
          await db.update(schema.whatsappOutboundMessages).set({
            deliveryRoute: "meta_only",
            wahaNumberId: null,
            providerErrorMessage: "Número da empresa indisponível; enviado pela API oficial Meta.",
            textVariant: null,
            updatedAt: new Date(),
          }).where(eq(schema.whatsappOutboundMessages.id, row.id));
        }
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
      } else if (row.purpose === "dutyPresenceConfirmation") {
        const variables = Array.isArray(row.variables) ? row.variables.filter((value): value is string => typeof value === "string") : [];
        if (variables[2]) urlButtonParameter = variables[2];
      }

      // Preserve the channel selected when the outbox row was created. This
      // is mandatory for the post-activation notice: it must use the same
      // corporate number that delivered the original invitation. Legacy rows
      // without a usable binding may still fall back to the tenant default.
      const channel = await resolveMetaOutboundChannel(row);
      if (!channel?.phoneNumberId || !channel.accessTokenCiphertext) throw new Error("Canal corporativo incompleto.");
      if (row.channelId !== channel.id || (!companyFallback && (row.deliveryRoute !== "meta_only" || row.wahaNumberId))) {
        await db.update(schema.whatsappOutboundMessages).set({
          channelId: channel.id,
          deliveryRoute: companyFallback ? "meta_then_waha" : "meta_only",
          wahaNumberId: companyFallback ? row.wahaNumberId : null,
          updatedAt: new Date(),
        }).where(and(
          eq(schema.whatsappOutboundMessages.id, row.id),
          eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
        ));
      }
      const phoneNumberId = channel.phoneNumberId;
      const accessToken = decryptChannelSecret(channel.accessTokenCiphertext, getMetaCloudServerConfig().tokenEncryptionKey);

      // A template exists per WhatsApp Business Account. Check the primary
      // one against the sending number's WABA before calling Meta, and fill
      // exactly the named parameters that approved version declares.
      let primaryParameters: { variables: string[]; variableNames: string[] } | undefined;
      // A blank stored value would make Meta reject the send (#131008): resolve from the approved template instead.
      const hasConfiguredParameters = Array.isArray(row.providerVariables) && row.providerVariables.length > 0
        && row.providerVariables.every((value) => typeof value === "string" && value.trim() !== "");
      if (row.messageType === "template" && channel.wabaId) {
        const wabaTemplates = await db.select({ name: schema.metaWhatsAppTemplates.name, language: schema.metaWhatsAppTemplates.language, componentsJson: schema.metaWhatsAppTemplates.componentsJson })
          .from(schema.metaWhatsAppTemplates)
          .where(and(
            eq(schema.metaWhatsAppTemplates.tenantId, row.tenantId),
            eq(schema.metaWhatsAppTemplates.wabaId, channel.wabaId),
            eq(schema.metaWhatsAppTemplates.status, "APPROVED"),
            isNull(schema.metaWhatsAppTemplates.deletedAt),
          ));
        const approved = wabaTemplates.filter((template) => template.name === row.templateName);
        const synced = approved.find((template) => template.language === row.templateLanguage) ?? approved[0];
        // Only trust the local catalog once this WABA was synchronized at all.
        if (!synced && wabaTemplates.length && !row.fallbackMessageType) {
          throw outboundChannelError("TEMPLATE_NOT_IN_WABA", `O modelo "${row.templateName}" não está aprovado no número que envia. Vincule um modelo aprovado desse número em Qualificação → Políticas de mensagem.`);
        }
        if (synced && !hasConfiguredParameters) {
          const resolved = resolveNamedTemplateBodyParameters({ purpose: row.purpose, rawVariables: stringList(row.variables), componentsJson: synced.componentsJson });
          if (resolved && !resolved.ok) {
            throw outboundChannelError("TEMPLATE_PARAMETERS_UNAVAILABLE", `O modelo "${row.templateName}" pede ${resolved.missing.map((name) => `{{${name}}}`).join(", ")}, que o CRM não preenche para este aviso.`);
          }
          if (resolved?.ok) primaryParameters = { variables: resolved.variables, variableNames: resolved.variableNames };
        }
      }

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
        declared?: { variables: string[]; variableNames: string[] };
      }) => {
        const configuredVariables = stringArray(resource.providerVariables);
        const variables = resource.declared?.variables ?? (configuredVariables.length > 0 ? configuredVariables : defaultTemplateVariables.bodyVariables);
        const configuredNames = stringArray(resource.variableNames);
        const variableNames = resource.declared?.variableNames ?? (configuredNames.length > 0 ? configuredNames : getMetaWhatsAppTemplateVariableNames(row.purpose));
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

      const coldReactivationMessage = row.idempotencyKey.startsWith("cold-lead-reactivation:");
      const coldAcknowledgementMessage = row.idempotencyKey.startsWith("cold-lead-reactivation-ack:");
      if ((coldReactivationMessage && !await isCurrentColdLeadReactivation(row))
        || (coldAcknowledgementMessage && !await isCurrentColdLeadAcknowledgement(row))) {
        const now = new Date();
        await db.update(schema.whatsappOutboundMessages).set({
          status: "cancelled",
          providerErrorCode: "COLD_LEAD_NO_LONGER_ELIGIBLE",
          providerErrorMessage: "O estado do lead mudou antes do envio; mensagem cancelada.",
          updatedAt: now,
        }).where(and(
          eq(schema.whatsappOutboundMessages.id, row.id),
          eq(schema.whatsappOutboundMessages.tenantId, row.tenantId),
        ));
        await db.insert(schema.auditLogs).values({
          id: randomUUID(),
          userId: await resolveSystemUserId(row.tenantId),
          entidade: "whatsapp_outbound_message",
          entidadeId: row.id,
          acao: coldReactivationMessage
            ? "cold_lead_reactivation.cancelled_not_eligible_before_provider"
            : "cold_lead_reactivation.ack_cancelled_before_provider",
          createdAt: now,
        });
        return;
      }

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
            declared: primaryParameters,
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
      if (row.purpose === "dutyPresenceConfirmation" && Array.isArray(row.variables) && typeof row.variables[2] === "string") {
        await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "sent", notificationErrorCode: null, updatedAt: new Date() }).where(and(
          eq(schema.dutyPresenceConfirmations.id, row.variables[2]),
          eq(schema.dutyPresenceConfirmations.tenantId, row.tenantId),
        ));
      }
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
      // Meta could not send a team notice (template missing, number without the
      // template, provider error): the company number carries it right away.
      if (row.deliveryRoute === "meta_then_waha" && row.wahaNumberId && row.noticeKey && await sendNoticeByCompanyNumber(row, error, Boolean(outboundId))) {
        sent += 1;
        return;
      }
      const message = error instanceof Error ? error.message : "Falha no envio via Meta Cloud API.";
      const code = error instanceof MetaCloudApiError
        ? String(error.code ?? error.status)
        : typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "META_OUTBOUND_FAILED")
          : "META_OUTBOUND_FAILED";
      const terminalInvitationFailure = row.purpose === "brokerInvitation" && terminalBrokerInvitationErrorCodes.has(code);
      const terminalTemplateFailure = terminalTemplateErrorCodes.has(code);

      const nextAttemptAt = !terminalInvitationFailure && !terminalTemplateFailure && row.attempts < 3
        ? new Date(Date.now() + Math.pow(2, row.attempts) * 60 * 1000)
        : null;
      const finalStatus: WhatsAppOutboundStatus = nextAttemptAt ? "pending" : "failed";
      await db.update(schema.whatsappOutboundMessages).set({ status: finalStatus, deliveryRoute: "meta_only", wahaNumberId: null, providerErrorCode: code, providerErrorMessage: message, nextAttemptAt, failedAt: nextAttemptAt ? null : new Date(), updatedAt: new Date() }).where(eq(schema.whatsappOutboundMessages.id, row.id));
      if (!nextAttemptAt && row.purpose === "dutyPresenceConfirmation" && Array.isArray(row.variables) && typeof row.variables[2] === "string") {
        await db.update(schema.dutyPresenceConfirmations).set({ notificationStatus: "error", notificationErrorCode: "TEMPLATE_DELIVERY_FAILED", updatedAt: new Date() }).where(and(
          eq(schema.dutyPresenceConfirmations.id, row.variables[2]),
          eq(schema.dutyPresenceConfirmations.tenantId, row.tenantId),
        ));
      }
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
