import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { handleLeadOfferWebhookResponse } from "@/features/lead-distribution/offers";
import { decryptChannelSecret } from "./secret-crypto";
import { sendMetaCloudText } from "./meta-cloud-client";
import { getMetaCloudServerConfig } from "./meta-cloud-config";
import { META_CLOUD_PROVIDER } from "./types";
import type { MetaWebhookPayload } from "./types";
import { shouldStartOrResumeAiQualification } from "@/features/qualification-engine/service";

export async function isMetaCloudWhatsAppEnabled() {
  const [row] = await getDatabase()
    .select({ value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, "feature_whatsapp_meta_cloud_enabled"))
    .limit(1);
  return row ? row.value !== "false" && row.value !== "disabled" : true;
}

export async function getPreferredMetaCloudChannel(input: { tenantId: string; branchId?: string | null; userId?: string | null }) {
  const db = getDatabase();
  const [channel] = await db
    .select()
    .from(schema.communicationChannels)
    .where(
      and(
        eq(schema.communicationChannels.tenantId, input.tenantId),
        eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER),
        eq(schema.communicationChannels.status, "active"),
        eq(schema.communicationChannels.registrationStatus, "registered"),
      ),
    )
    .limit(1);
  return channel ?? null;
}

export async function sendMetaCloudChannelText(input: { channel: typeof schema.communicationChannels.$inferSelect; to: string; body: string }) {
  if (input.channel.registrationStatus !== "registered") {
    throw new Error("O número oficial ainda não foi ativado para a Cloud API.");
  }
  if (!input.channel.phoneNumberId || !input.channel.accessTokenCiphertext) {
    throw new Error("Canal corporativo incompleto.");
  }
  const accessToken = decryptChannelSecret(
    input.channel.accessTokenCiphertext,
    getMetaCloudServerConfig().tokenEncryptionKey,
  );
  const response = await sendMetaCloudText({
    phoneNumberId: input.channel.phoneNumberId,
    accessToken,
    to: input.to,
    body: input.body,
  });
  const messageId = response.messages?.[0]?.id;
  if (!messageId) throw new Error("A Meta não retornou o ID da mensagem.");
  return { messageId };
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function samePhone(left: string, right: string) {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && b) && (a === b || a.endsWith(b) || b.endsWith(a) || a.slice(-11) === b.slice(-11));
}

export function matchesKnownBrokerPhone(phone: string, brokerPhones: readonly string[]) {
  return brokerPhones.some((brokerPhone) => samePhone(brokerPhone, phone));
}

async function registerWebhookEvent(input: { channelId: string | null; externalEventId: string; eventType: string; payloadHash: string }) {
  const [event] = await getDatabase().insert(schema.communicationChannelWebhookEvents).values({
    id: randomUUID(), channelId: input.channelId, provider: META_CLOUD_PROVIDER, externalEventId: input.externalEventId, eventType: input.eventType, payloadHash: input.payloadHash,
  }).onConflictDoNothing().returning({ id: schema.communicationChannelWebhookEvents.id });
  return event?.id ?? null;
}

async function setWebhookEventResult(id: string, status: string, errorCode?: string) {
  await getDatabase().update(schema.communicationChannelWebhookEvents).set({ status, errorCode: errorCode ?? null, processedAt: new Date() }).where(eq(schema.communicationChannelWebhookEvents.id, id));
}

export async function ingestMetaCloudWebhook(payload: MetaWebhookPayload, rawPayload: string) {
  const payloadHash = createHash("sha256").update(rawPayload).digest("hex");
  if (payload.object !== "whatsapp_business_account") return { processed: 0, ignored: 1 };
  let processed = 0;
  let ignored = 0;
  const db = getDatabase();

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== "messages") continue;
      const phoneNumberId = change.value?.metadata?.phone_number_id;
      if (!phoneNumberId) { ignored += 1; continue; }
      const [channel] = await db.select().from(schema.communicationChannels).where(and(eq(schema.communicationChannels.provider, META_CLOUD_PROVIDER), eq(schema.communicationChannels.phoneNumberId, phoneNumberId))).limit(1);
      if (!channel || channel.status !== "active") {
        await registerWebhookEvent({ channelId: channel?.id ?? null, externalEventId: `unknown:${payloadHash}`, eventType: "messages", payloadHash });
        ignored += 1;
        continue;
      }
      await db.update(schema.communicationChannels).set({ lastWebhookAt: new Date(), updatedAt: new Date() }).where(eq(schema.communicationChannels.id, channel.id));
      const brokerProfiles = await db
        .select({ id: schema.brokerProfiles.id, phone: schema.brokerProfiles.phone })
        .from(schema.brokerProfiles)
        .where(eq(schema.brokerProfiles.tenantId, channel.tenantId));

      for (const message of change.value?.messages ?? []) {
        const eventId = await registerWebhookEvent({ channelId: channel.id, externalEventId: message.id, eventType: `message.${message.type ?? "unknown"}`, payloadHash });
        if (!eventId) continue;

        // Extract button response text/payload or standard text body
        const messageKind = (["audio", "image", "document", "video", "sticker"] as const).includes(message.type as "audio" | "image" | "document" | "video" | "sticker") ? message.type as "audio" | "image" | "document" | "video" | "sticker" : "text";
        let text = message.type === "text" ? message.text?.body?.trim() ?? "" : "";
        let buttonText: string | undefined;
        let buttonPayload: string | undefined;

        if (message.type === "button") {
          buttonText = message.button?.text?.trim();
          buttonPayload = message.button?.payload?.trim();
          text = buttonText || buttonPayload || text;
        } else if (message.type === "interactive") {
          buttonText = message.interactive?.button_reply?.title?.trim();
          buttonPayload = message.interactive?.button_reply?.id?.trim();
          text = buttonText || buttonPayload || text;
        }

        const phone = normalizePhone(message.from);
        const brokerProfile = brokerProfiles.find((profile) => matchesKnownBrokerPhone(phone, [profile.phone]));

        // Check if message is a response to a lead offer before persisting it as
        // a broker-channel message. A broker must never be turned into a lead.
        if (text) {
          await handleLeadOfferWebhookResponse({
            tenantId: channel.tenantId,
            phone: message.from,
            buttonText: buttonText || text,
            buttonPayload: buttonPayload,
            providerMessageId: message.context?.id,
          });
        }

        if (brokerProfile) {
          await db.insert(schema.whatsappMessages).values({
            id: randomUUID(),
            tenantId: channel.tenantId,
            leadId: null,
            clientId: null,
            communicationChannelId: channel.id,
            provider: META_CLOUD_PROVIDER,
            providerStatus: "received",
            messageId: message.id,
            phone,
            direction: "incoming",
            body: text || `[${messageKind}]`,
            sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
          }).onConflictDoNothing({ target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId] });
          console.info("[whatsapp/broker-channel] inbound.received", { tenantId: channel.tenantId, brokerProfileId: brokerProfile.id, messageKind });
          await setWebhookEventResult(eventId, "processed");
          processed += 1;
          continue;
        }

        if (!text && messageKind === "text" && message.type !== "text") { await setWebhookEventResult(eventId, "discarded", "unsupported_message_type"); ignored += 1; continue; }
        const [leads, clients] = await Promise.all([
          db.select({ id: schema.leads.id, phone: schema.leads.telefone, status: schema.leads.status, qualificationStatus: schema.leads.qualificationStatus }).from(schema.leads).where(and(eq(schema.leads.tenantId, channel.tenantId), isNull(schema.leads.deletedAt))),
          db.select({ id: schema.clients.id, phone: schema.clients.telefone }).from(schema.clients).where(eq(schema.clients.tenantId, channel.tenantId)),
        ]);
        const matchingLeads = leads.filter((item) => samePhone(item.phone, phone));
        const lead = matchingLeads.find((item) => ["in_contact", "quote_sent", "negotiation", "documentation_pending", "under_analysis"].includes(item.status)) ?? matchingLeads[0];
        const matchedClient = clients.find((item) => samePhone(item.phone, phone));
        let activeLeadId = lead?.id;
        if (!lead && !matchedClient) {
          // Etapa 2 — Criar novo lead automaticamente para contato recebido sem cadastro
          activeLeadId = randomUUID();
          await db.insert(schema.leads).values({
            id: activeLeadId,
            tenantId: channel.tenantId,
            nome: `Lead WhatsApp (${phone.slice(-4)})`,
            telefone: phone,
            origem: "webhook",
            status: "new",
            serviceStartedAt: new Date(),
          });
        }

        await db.insert(schema.whatsappMessages).values({
          id: randomUUID(),
          tenantId: channel.tenantId,
          leadId: activeLeadId ?? null,
          clientId: matchedClient?.id ?? null,
          communicationChannelId: channel.id,
          provider: META_CLOUD_PROVIDER,
          providerStatus: "received",
          messageId: message.id,
          phone,
          direction: "incoming",
          body: text || `[${messageKind}]`,
          sentAt: message.timestamp ? new Date(Number(message.timestamp) * 1000) : new Date(),
        }).onConflictDoNothing({ target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId] });

        if (activeLeadId && shouldStartOrResumeAiQualification(lead?.qualificationStatus ?? "pending")) {
          const { processInboundAiResponse } = await import("@/features/ai-agent/conversation-state-machine");
          try {
            const aiResult = await processInboundAiResponse({
              tenantId: channel.tenantId,
              leadId: activeLeadId,
              phone: message.from,
              userMessageBody: text,
              messageKind,
              communicationChannelId: channel.id,
              providerMessageId: message.id,
            });
            console.info("[ai-wpp] inbound.completed", {
              tenantId: channel.tenantId,
              leadId: activeLeadId,
              status: aiResult.status,
              deliveryStatus: "deliveryStatus" in aiResult ? aiResult.deliveryStatus : undefined,
            });
          } catch (error) {
            console.error("[ai-wpp] inbound.failed", {
              tenantId: channel.tenantId,
              leadId: activeLeadId,
              error: error instanceof Error ? error.message.slice(0, 240) : "unknown_error",
            });
          }
        } else if (activeLeadId) {
          console.info("[ai-wpp] inbound.ignored_non_pending_qualification", {
            tenantId: channel.tenantId,
            leadId: activeLeadId,
            qualificationStatus: lead?.qualificationStatus ?? "unknown",
          });
        }
        await setWebhookEventResult(eventId, "processed");
        processed += 1;
      }

      for (const status of change.value?.statuses ?? []) {
        const eventId = await registerWebhookEvent({ channelId: channel.id, externalEventId: `${status.id}:${status.status}`, eventType: "message.status", payloadHash });
        if (!eventId) continue;
        await db.update(schema.whatsappMessages).set({ providerStatus: status.status }).where(and(eq(schema.whatsappMessages.tenantId, channel.tenantId), eq(schema.whatsappMessages.messageId, status.id), eq(schema.whatsappMessages.provider, META_CLOUD_PROVIDER)));
        const outboundUpdate: Partial<typeof schema.whatsappOutboundMessages.$inferInsert> = { updatedAt: new Date() };
        if (["sent", "delivered", "read"].includes(status.status)) outboundUpdate.status = status.status;
        else if (["failed", "deleted"].includes(status.status)) outboundUpdate.status = "failed";
        if (status.status === "sent") outboundUpdate.sentAt = new Date();
        if (status.status === "delivered") outboundUpdate.deliveredAt = new Date();
        if (status.status === "read") outboundUpdate.readAt = new Date();
        if (status.status === "failed" || status.status === "deleted") outboundUpdate.failedAt = new Date();
        const [outbound] = await db.update(schema.whatsappOutboundMessages).set(outboundUpdate).where(and(eq(schema.whatsappOutboundMessages.tenantId, channel.tenantId), eq(schema.whatsappOutboundMessages.providerMessageId, status.id))).returning({ id: schema.whatsappOutboundMessages.id, recipientId: schema.whatsappOutboundMessages.recipientId, purpose: schema.whatsappOutboundMessages.purpose });

        if (outbound?.purpose === "brokerInvitation" && outbound.recipientId && ["delivered", "read"].includes(status.status)) {
          await db.update(schema.brokerInvitations).set({ deliveryStatus: "sent", deliveryMessageId: status.id, deliveredAt: new Date() }).where(and(eq(schema.brokerInvitations.id, outbound.recipientId), eq(schema.brokerInvitations.tenantId, channel.tenantId)));
        } else if (outbound?.purpose === "newLeadAssignment" && ["delivered", "read"].includes(status.status)) {
          await db.update(schema.leadOffers).set({ status: status.status.toUpperCase() as "DELIVERED" | "READ", updatedAt: new Date() }).where(and(eq(schema.leadOffers.outboundMessageId, outbound.id), eq(schema.leadOffers.tenantId, channel.tenantId)));
        }

        await setWebhookEventResult(eventId, "processed");
        processed += 1;
      }
    }
  }
  return { processed, ignored };
}
