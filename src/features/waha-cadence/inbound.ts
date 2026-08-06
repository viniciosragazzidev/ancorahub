import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { phoneHash, type WahaWebhookEvent, WAHA_AI_FEATURE, WAHA_CADENCE_FEATURE } from "./contract";

export async function ingestWahaWebhook(event: WahaWebhookEvent, rawPayload: string) {
  if ((await getSystemSetting(WAHA_CADENCE_FEATURE)) !== "true") return { processed: 0, ignored: "feature_disabled" as const };
  const db = getDatabase();
  const payloadHash = createHash("sha256").update(rawPayload).digest("hex");
  const [registered] = await db.insert(schema.wahaWebhookEvents).values({ id: randomUUID(), externalEventId: event.eventId, eventType: event.type, payloadHash })
    .onConflictDoNothing().returning({ id: schema.wahaWebhookEvents.id });
  if (!registered) return { processed: 0, ignored: "duplicate" as const };

  const [number] = await db.select().from(schema.wahaNumbers).where(eq(schema.wahaNumbers.relaySessionId, event.sessionId)).limit(1);
  if (!number) {
    await db.update(schema.wahaWebhookEvents).set({ status: "ignored", errorCode: "unknown_session", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
    return { processed: 0, ignored: "unknown_session" as const };
  }
  if (!number.capabilities.inbound && event.type === "message.inbound") {
    await db.update(schema.wahaWebhookEvents).set({ status: "ignored", errorCode: "inbound_disabled", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
    return { processed: 0, ignored: "inbound_disabled" as const };
  }

  if (event.type === "session.status") {
    await db.update(schema.wahaNumbers).set({ status: event.sessionStatus ?? "offline", lastHealthAt: new Date(), updatedAt: new Date() }).where(eq(schema.wahaNumbers.id, number.id));
    await db.update(schema.wahaWebhookEvents).set({ status: "processed", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
    return { processed: 1 };
  }

  if (event.type === "message.status" && event.delivery) {
    await db.update(schema.wahaDeliveryOutbox).set({ status: event.delivery.status === "failed" ? "failed" : event.delivery.status, providerMessageId: event.delivery.providerMessageId ?? undefined, completedAt: event.delivery.status === "failed" ? undefined : new Date(), failedAt: event.delivery.status === "failed" ? new Date() : undefined, updatedAt: new Date() })
      .where(eq(schema.wahaDeliveryOutbox.idempotencyKey, event.delivery.idempotencyKey));
    await db.update(schema.wahaWebhookEvents).set({ status: "processed", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
    return { processed: 1 };
  }

  if (!event.message) {
    await db.update(schema.wahaWebhookEvents).set({ status: "ignored", errorCode: "missing_message", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
    return { processed: 0, ignored: "missing_message" as const };
  }
  const hash = phoneHash(event.message.from);
  const [run] = await db.select().from(schema.wahaCadenceRuns)
    .where(and(eq(schema.wahaCadenceRuns.wahaNumberId, number.id), eq(schema.wahaCadenceRuns.contactPhoneHash, hash)))
    .orderBy(desc(schema.wahaCadenceRuns.createdAt)).limit(1);
  if (!run) {
    await db.update(schema.wahaWebhookEvents).set({ status: "ignored", errorCode: "unmatched_contact", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
    return { processed: 0, ignored: "unmatched_contact" as const };
  }

  const leadId = run.recipientType === "lead" ? run.recipientId : null;
  const clientId = run.recipientType === "client" ? run.recipientId : null;
  await db.transaction(async (tx) => {
    await tx.insert(schema.whatsappMessages).values({ id: randomUUID(), tenantId: run.tenantId, leadId, clientId, provider: "waha", providerStatus: "received", messageId: event.message!.id, phone: event.message!.from, direction: "incoming", body: event.message!.body, sentAt: new Date(event.occurredAt) }).onConflictDoNothing({ target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId] });
    await tx.update(schema.wahaCadenceRuns).set({ inboundAt: new Date(event.occurredAt), status: "active", updatedAt: new Date() }).where(eq(schema.wahaCadenceRuns.id, run.id));
  });

  // Client-only runs remain visible to the team. The existing AI state machine is
  // lead-centric, so it only answers after a tenant-scoped lead is resolved.
  if (leadId && number.capabilities.ai && (await getSystemSetting(WAHA_AI_FEATURE)) === "true") {
    const { processInboundAiResponse } = await import("@/features/ai-agent/conversation-state-machine");
    await processInboundAiResponse({ tenantId: run.tenantId, leadId, phone: event.message.from, userMessageBody: event.message.body, communicationChannelId: null, providerMessageId: event.message.id, transport: "waha", wahaRunId: run.id });
  }
  await db.update(schema.wahaWebhookEvents).set({ status: "processed", processedAt: new Date() }).where(eq(schema.wahaWebhookEvents.id, registered.id));
  return { processed: 1 };
}
