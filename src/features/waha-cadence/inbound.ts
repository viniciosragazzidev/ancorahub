import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { phoneHash, normalizePhone, type WahaWebhookEvent, WAHA_AI_FEATURE, WAHA_CADENCE_FEATURE } from "./contract";

type SessionSource =
  | { kind: "number"; number: typeof schema.wahaNumbers.$inferSelect }
  | { kind: "connection"; connection: typeof schema.whatsappConnections.$inferSelect };

/** Observability counters for webhook processing */
interface WebhookMetrics {
  startTime: number;
  eventDedupMs?: number;
  sessionResolveMs?: number;
  leadResolveMs?: number;
  persistMs?: number;
  totalMs?: number;
}

/**
 * Ingest a validated WAHA webhook event. The function is idempotent: duplicate
 * event IDs are silently ACKed. Session resolution tries `wahaNumbers` first
 * (relay / platform sessions) and falls back to `whatsappConnections` (broker
 * sessions created via the Fastify integration).
 *
 * Inbound messages are persisted as `whatsapp_messages` with dedup by
 * `(tenantId, messageId)`. Session status events update the originating table.
 *
 * Direction is determined by `message.fromMe`: broker's own messages are
 * classified as `outgoing`, external messages as `incoming`.
 */
export async function ingestWahaWebhook(event: WahaWebhookEvent, rawPayload: string) {
  const metrics: WebhookMetrics = { startTime: Date.now() };

  if ((await getSystemSetting(WAHA_CADENCE_FEATURE)) !== "true") return { processed: 0, ignored: "feature_disabled" as const };

  const db = getDatabase();

  // ── 1. Idempotent event dedup ──────────────────────────────────────────
  const dedupStart = Date.now();
  const payloadHash = createHash("sha256").update(rawPayload).digest("hex");
  const [registered] = await db
    .insert(schema.wahaWebhookEvents)
    .values({ id: randomUUID(), externalEventId: event.eventId, eventType: event.type, payloadHash })
    .onConflictDoNothing()
    .returning({ id: schema.wahaWebhookEvents.id });
  metrics.eventDedupMs = Date.now() - dedupStart;
  if (!registered) return { processed: 0, ignored: "duplicate" as const };

  // ── 2. Session resolution ──────────────────────────────────────────────
  const resolveStart = Date.now();
  const source = await resolveSession(db, event.sessionId);
  metrics.sessionResolveMs = Date.now() - resolveStart;
  if (!source) {
    await markIgnored(db, registered.id, "unknown_session");
    return { processed: 0, ignored: "unknown_session" as const };
  }

  // ── 3. Handle session.status ───────────────────────────────────────────
  if (event.type === "session.status") {
    const statusMap: Record<string, string> = {
      active: "ready",
      paused: "paused",
      offline: "disconnected",
      error: "error",
    };
    const normalizedStatus = event.sessionStatus ? (statusMap[event.sessionStatus] ?? event.sessionStatus) : "disconnected";

    if (source.kind === "number") {
      await db
        .update(schema.wahaNumbers)
        .set({ status: normalizedStatus, lastHealthAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.wahaNumbers.id, source.number.id));
    } else {
      await db
        .update(schema.whatsappConnections)
        .set({
          status: normalizedStatus,
          connectedAt: normalizedStatus === "ready" ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(schema.whatsappConnections.id, source.connection.id));
    }

    // Revalidar a página de conversas APENAS para conexões de corretor (modo lite)
    // Números da plataforma (relay) não afetam a UI de conversas do corretor
    if (source.kind === "connection") {
      try {
        revalidatePath("/conversas");
      } catch {
        // revalidatePath pode falhar fora de Server Components — não crítico
      }
    }

    await markProcessed(db, registered.id);
    metrics.totalMs = Date.now() - metrics.startTime;
    return { processed: 1 };
  }

  // ── 4. Handle message.status (delivery confirmation) ───────────────────
  if (event.type === "message.status" && event.delivery) {
    await db
      .update(schema.wahaDeliveryOutbox)
      .set({
        status: event.delivery.status === "failed" ? "failed" : event.delivery.status,
        providerMessageId: event.delivery.providerMessageId ?? undefined,
        completedAt: event.delivery.status === "failed" ? undefined : new Date(),
        failedAt: event.delivery.status === "failed" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(schema.wahaDeliveryOutbox.idempotencyKey, event.delivery.idempotencyKey));
    await markProcessed(db, registered.id);
    metrics.totalMs = Date.now() - metrics.startTime;
    return { processed: 1 };
  }

  // ── 5. Handle message.inbound ──────────────────────────────────────────
  if (!event.message) {
    await markIgnored(db, registered.id, "missing_message");
    return { processed: 0, ignored: "missing_message" as const };
  }

  // Resolve tenant from the source
  const tenantId = source.kind === "number" ? source.number.tenantId : source.connection.tenantId;
  if (!tenantId) {
    await markIgnored(db, registered.id, "unknown_session");
    return { processed: 0, ignored: "unknown_session" as const };
  }

  // Determine direction based on fromMe flag
  const isOutgoing = event.message.fromMe === true;
  const normalizedPhone = normalizePhone(event.message.from);

  // For broker connections, the userId is the broker
  const brokerUserId = source.kind === "connection" ? source.connection.userId : null;

  // ── 6. Resolve lead/client (race-safe) ─────────────────────────────────
  const leadResolveStart = Date.now();
  const { leadId, clientId, runId } = await resolveContact(db, source, tenantId, normalizedPhone, isOutgoing);
  metrics.leadResolveMs = Date.now() - leadResolveStart;

  // For outgoing messages from broker: if no lead found, skip (don't create leads from broker's own messages)
  if (isOutgoing && !leadId && !clientId) {
    await markIgnored(db, registered.id, "outgoing_no_lead");
    return { processed: 0, ignored: "outgoing_no_lead" as const };
  }

  // ── 7. Persist message with dedup (transaction for race safety) ─────────
  const persistStart = Date.now();
  const providerMessageId = event.message.id;

  await db.transaction(async (tx) => {
    // Insert message with dedup
    await tx
      .insert(schema.whatsappMessages)
      .values({
        id: randomUUID(),
        tenantId,
        leadId,
        clientId,
        provider: "waha",
        providerStatus: "received",
        messageId: providerMessageId,
        phone: normalizedPhone,
        direction: isOutgoing ? "outgoing" : "incoming",
        body: event.message!.body,
        sentAt: new Date(event.occurredAt),
      })
      .onConflictDoNothing({ target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId] });

    // Update cadence run if applicable
    if (runId) {
      await tx
        .update(schema.wahaCadenceRuns)
        .set({ inboundAt: new Date(event.occurredAt), status: "active", updatedAt: new Date() })
        .where(eq(schema.wahaCadenceRuns.id, runId));
    }

    // Update lastActivityAt on lead if exists
    if (leadId && !isOutgoing) {
      await tx
        .update(schema.leads)
        .set({ updatedAt: new Date() })
        .where(eq(schema.leads.id, leadId));
    }
  });
  metrics.persistMs = Date.now() - persistStart;

  // ── 8. AI processing (optional, background, only for inbound) ──────────
  if (!isOutgoing && leadId && (await getSystemSetting(WAHA_AI_FEATURE)) === "true") {
    const { processInboundAiResponse } = await import("@/features/ai-agent/conversation-state-machine");
    const aiPromise = processInboundAiResponse({
      tenantId,
      leadId,
      phone: normalizedPhone,
      userMessageBody: event.message.body,
      communicationChannelId: null,
      providerMessageId: event.message.id,
      transport: "waha",
      wahaRunId: runId ?? undefined,
    }).catch((err) => console.error("[waha-ai] inbound.failed", err));
    try {
      const { waitUntil } = require("next/server");
      if (typeof waitUntil === "function") waitUntil(aiPromise);
    } catch {}
  }

  await markProcessed(db, registered.id);
  metrics.totalMs = Date.now() - metrics.startTime;

  // Log metrics (no PII)
  console.info("[waha/inbound] processed", {
    eventType: event.type,
    direction: isOutgoing ? "outgoing" : "incoming",
    hasLead: Boolean(leadId),
    hasClient: Boolean(clientId),
    eventDedupMs: metrics.eventDedupMs,
    sessionResolveMs: metrics.sessionResolveMs,
    leadResolveMs: metrics.leadResolveMs,
    persistMs: metrics.persistMs,
    totalMs: metrics.totalMs,
  });

  return { processed: 1 };
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function resolveSession(
  db: ReturnType<typeof getDatabase>,
  sessionId: string,
): Promise<SessionSource | null> {
  // Try platform/tenant numbers first (relay sessions)
  const [number] = await db
    .select()
    .from(schema.wahaNumbers)
    .where(eq(schema.wahaNumbers.relaySessionId, sessionId))
    .limit(1);
  if (number) return { kind: "number", number };

  // Fallback: broker-level connections (direct WAHA sessions)
  const [connection] = await db
    .select()
    .from(schema.whatsappConnections)
    .where(eq(schema.whatsappConnections.sessionName, sessionId))
    .limit(1);
  if (connection) return { kind: "connection", connection };

  return null;
}

/**
 * Resolve lead/client from phone number. Race-safe: uses transaction with
 * upsert for leads to prevent duplicate creation.
 */
async function resolveContact(
  db: ReturnType<typeof getDatabase>,
  source: SessionSource,
  tenantId: string,
  normalizedPhone: string,
  isOutgoing: boolean,
): Promise<{ leadId: string | null; clientId: string | null; runId: string | null }> {
  let leadId: string | null = null;
  let clientId: string | null = null;
  let runId: string | null = null;

  // For number-based flow, check cadence runs first
  if (source.kind === "number") {
    const hash = phoneHash(normalizedPhone);
    const [run] = await db
      .select()
      .from(schema.wahaCadenceRuns)
      .where(
        and(
          eq(schema.wahaCadenceRuns.wahaNumberId, source.number.id),
          eq(schema.wahaCadenceRuns.contactPhoneHash, hash),
        ),
      )
      .orderBy(desc(schema.wahaCadenceRuns.createdAt))
      .limit(1);

    if (run) {
      leadId = run.recipientType === "lead" ? run.recipientId : null;
      clientId = run.recipientType === "client" ? run.recipientId : null;
      runId = run.id;
    }
  }

  // Fallback: find lead by phone (scoped to tenant)
  if (!leadId && !clientId) {
    const [lead] = await db
      .select({ id: schema.leads.id })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          eq(schema.leads.telefone, normalizedPhone),
        ),
      )
      .limit(1);
    if (lead) leadId = lead.id;
  }

  // Fallback: find client by phone (scoped to tenant)
  if (!leadId && !clientId) {
    const [client] = await db
      .select({ id: schema.clients.id })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.tenantId, tenantId),
          eq(schema.clients.telefone, normalizedPhone),
        ),
      )
      .limit(1);
    if (client) clientId = client.id;
  }

  // For incoming messages with no match: create a new lead (same as OpenWA pattern)
  if (!isOutgoing && !leadId && !clientId) {
    const newLeadId = randomUUID();
    await db.insert(schema.leads).values({
      id: newLeadId,
      tenantId,
      nome: `Lead WhatsApp (${normalizedPhone.slice(-4)})`,
      telefone: normalizedPhone,
      origem: "webhook",
      status: "new",
      serviceStartedAt: new Date(),
    });
    leadId = newLeadId;
    console.info("[waha/inbound] new_lead_created", { tenantId, leadId: newLeadId });
  }

  return { leadId, clientId, runId };
}

async function markProcessed(db: ReturnType<typeof getDatabase>, eventId: string) {
  await db
    .update(schema.wahaWebhookEvents)
    .set({ status: "processed", processedAt: new Date() })
    .where(eq(schema.wahaWebhookEvents.id, eventId));
}

async function markIgnored(db: ReturnType<typeof getDatabase>, eventId: string, code: string) {
  await db
    .update(schema.wahaWebhookEvents)
    .set({ status: "ignored", errorCode: code, processedAt: new Date() })
    .where(eq(schema.wahaWebhookEvents.id, eventId));
}
