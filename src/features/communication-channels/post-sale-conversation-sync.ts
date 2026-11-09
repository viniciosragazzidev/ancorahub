import "server-only";

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { publishConversationInvalidation } from "@/features/notifications/realtime-sync";
import { getDatabase, schema } from "@/shared/db";

import { META_CLOUD_PROVIDER } from "./types";
import { resolvePostSaleConversationBody } from "./post-sale-conversation-domain";

const POST_SALE_PROVIDER_STATUSES = ["sent", "delivered", "read", "failed"] as const;

/** Mirrors one accepted post-sale outbox message into the canonical lead conversation history. */
export async function syncPostSaleConversationMessage(input: { tenantId: string; outboundId: string }) {
  const db = getDatabase();
  const [message] = await db.select({
    id: schema.whatsappOutboundMessages.id,
    tenantId: schema.whatsappOutboundMessages.tenantId,
    recipientType: schema.whatsappOutboundMessages.recipientType,
    recipientId: schema.whatsappOutboundMessages.recipientId,
    channelId: schema.whatsappOutboundMessages.channelId,
    deliveryRoute: schema.whatsappOutboundMessages.deliveryRoute,
    wahaNumberId: schema.whatsappOutboundMessages.wahaNumberId,
    templateName: schema.whatsappOutboundMessages.templateName,
    variables: schema.whatsappOutboundMessages.variables,
    renderedBody: schema.whatsappOutboundMessages.renderedBody,
    providerMessageId: schema.whatsappOutboundMessages.providerMessageId,
    status: schema.whatsappOutboundMessages.status,
    destinationPhone: schema.whatsappOutboundMessages.destinationPhone,
    sentAt: schema.whatsappOutboundMessages.sentAt,
  }).from(schema.whatsappOutboundMessages).where(and(
    eq(schema.whatsappOutboundMessages.id, input.outboundId),
    eq(schema.whatsappOutboundMessages.tenantId, input.tenantId),
    eq(schema.whatsappOutboundMessages.purpose, "postSaleSurvey"),
  )).limit(1);

  if (!message || message.recipientType !== "lead" || !message.recipientId || !message.sentAt) return false;
  if (!POST_SALE_PROVIDER_STATUSES.includes(message.status as (typeof POST_SALE_PROVIDER_STATUSES)[number])) return false;

  const [lead] = await db.select({ id: schema.leads.id }).from(schema.leads).where(and(
    eq(schema.leads.id, message.recipientId),
    eq(schema.leads.tenantId, message.tenantId),
  )).limit(1);
  if (!lead) return false;

  const body = resolvePostSaleConversationBody({
    renderedBody: message.renderedBody,
    templateName: message.templateName,
    variables: message.variables,
  });
  if (!body) return false;

  const providerMessageId = message.providerMessageId && message.providerMessageId !== "wamid_sent"
    ? message.providerMessageId
    : null;
  const providerStatus = message.status as (typeof POST_SALE_PROVIDER_STATUSES)[number];
  const provider = message.deliveryRoute === "waha_direct" ? "waha" : META_CLOUD_PROVIDER;
  const values = {
    id: `post_sale_outbound_${message.id}`,
    tenantId: message.tenantId,
    leadId: lead.id,
    communicationChannelId: message.channelId ?? undefined,
    wahaNumberId: message.wahaNumberId ?? undefined,
    senderRole: "assistant",
    provider,
    ...(providerMessageId ? { messageId: providerMessageId } : {}),
    providerStatus,
    phone: message.destinationPhone,
    direction: "outbound",
    body,
    sentAt: message.sentAt,
  };

  const [inserted] = await db.insert(schema.whatsappMessages).values(values)
    .onConflictDoNothing()
    .returning({ id: schema.whatsappMessages.id });

  // A webhook may have already created the canonical message, or a duplicate
  // status event may arrive after this mirror. Update only the same tenant,
  // lead, provider and outbound message, preserving the most advanced receipt.
  const matchingMessage = providerMessageId
    ? or(
      eq(schema.whatsappMessages.id, values.id),
      eq(schema.whatsappMessages.messageId, providerMessageId),
    )
    : eq(schema.whatsappMessages.id, values.id);
  const [updated] = inserted ? [] : await db.update(schema.whatsappMessages).set({
    providerStatus: sql`case
      when ${schema.whatsappMessages.providerStatus} = 'failed' or ${providerStatus} = 'failed' then 'failed'
      when ${schema.whatsappMessages.providerStatus} = 'read' or ${providerStatus} = 'read' then 'read'
      when ${schema.whatsappMessages.providerStatus} = 'delivered' or ${providerStatus} = 'delivered' then 'delivered'
      else ${providerStatus}
    end`,
  }).where(and(
    eq(schema.whatsappMessages.tenantId, message.tenantId),
    eq(schema.whatsappMessages.leadId, lead.id),
    eq(schema.whatsappMessages.direction, "outbound"),
    inArray(schema.whatsappMessages.provider, provider === META_CLOUD_PROVIDER ? [META_CLOUD_PROVIDER, "meta"] : [provider]),
    matchingMessage,
  )).returning({ id: schema.whatsappMessages.id });

  const stored = inserted ?? updated;
  if (stored) void publishConversationInvalidation({ tenantId: message.tenantId }).catch(() => undefined);
  return Boolean(stored);
}
