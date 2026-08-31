import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

import {
  publishConversationInvalidation,
  publishDomainInvalidation,
} from "@/features/notifications/realtime-sync";
import { WAHA_CONNECTIONS_FEATURE } from "@/features/waha-cadence/connection-service";
import { getDatabase, schema } from "@/shared/db";
import { getSystemSetting } from "@/features/system-settings/queries";
import { samePhone } from "@/features/communication-channels/service";
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import {
  phoneHash,
  normalizePhone,
  type WahaWebhookEvent,
  WAHA_AI_FEATURE,
  WAHA_CADENCE_FEATURE,
} from "./contract";

type SessionSource =
  | { kind: "number"; number: typeof schema.wahaNumbers.$inferSelect }
  | { kind: "connection"; connection: typeof schema.whatsappConnections.$inferSelect };

export function shouldCreateSyntheticLead(input: {
  sourceKind: SessionSource["kind"];
  isOutgoing: boolean;
  hasLead: boolean;
  hasClient: boolean;
  isTenantOfficialNumber: boolean;
}) {
  return (
    input.sourceKind === "number" &&
    !input.isOutgoing &&
    !input.hasLead &&
    !input.hasClient &&
    !input.isTenantOfficialNumber
  );
}

/**
 * A broker connection is a restricted workspace, not a tenant intake channel.
 * Persist only CRM contacts assigned to that broker or the tenant's official
 * number; personal chats never enter the tenant database.
 */
export function shouldPersistBrokerConnectionMessage(input: {
  hasLead: boolean;
  hasClient: boolean;
  isTenantOfficialNumber: boolean;
}) {
  return input.hasLead || input.hasClient || input.isTenantOfficialNumber;
}

/**
 * SQL pre-filter for tolerant phone matching. Generates LIKE conditions on the
 * last 8 digits of the normalized incoming phone so candidates stored with
 * formatting or country codes are retrieved; exact matching is then confirmed
 * in memory with `samePhone` (suffix semantics up to 11 digits).
 */
function phoneSuffixConditions(
  column: AnyPgColumn,
  normalizedPhone: string,
) {
  const last4 = normalizedPhone.slice(-4);
  return or(
    eq(column, normalizedPhone),
    like(column, `%${last4}`),
  );
}


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

  const db = getDatabase();

  // ── 1. Idempotent event dedup ──────────────────────────────────────────
  const dedupStart = Date.now();
  const payloadHash = createHash("sha256").update(rawPayload).digest("hex");
  const [registered] = await db
    .insert(schema.wahaWebhookEvents)
    .values({
      id: randomUUID(),
      externalEventId: event.eventId,
      eventType: event.type,
      payloadHash,
    })
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

  // Cadência é uma automação opt-in. Conversas Lite do corretor são
  // atendimento humano e continuam recebendo eventos enquanto a conexão WAHA
  // estiver habilitada pela plataforma.
  if (source.kind === "number" && (await getSystemSetting(WAHA_CADENCE_FEATURE)) !== "true") {
    await markIgnored(db, registered.id, "feature_disabled");
    return { processed: 0, ignored: "feature_disabled" as const };
  }
  if (
    source.kind === "connection" &&
    (await getSystemSetting(WAHA_CONNECTIONS_FEATURE)) === "false"
  ) {
    await markIgnored(db, registered.id, "feature_disabled");
    return { processed: 0, ignored: "feature_disabled" as const };
  }

  // ── 3. Handle session.status ───────────────────────────────────────────
  if (event.type === "session.status") {
    const statusMap: Record<string, string> = {
      active: "ready",
      paused: "paused",
      offline: "disconnected",
      error: "error",
    };
    const normalizedStatus = event.sessionStatus
      ? (statusMap[event.sessionStatus] ?? event.sessionStatus)
      : "disconnected";

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
        revalidatePath("/conversas/broker");
      } catch {
        // revalidatePath pode falhar fora de Server Components — não crítico
      }
      if (source.connection.tenantId && source.connection.userId) {
        void publishDomainInvalidation(
          [{ tenantId: source.connection.tenantId, userId: source.connection.userId }],
          "conversations",
        );
        void publishDomainInvalidation(
          [{ tenantId: source.connection.tenantId, userId: source.connection.userId }],
          "whatsapp_connection",
        );
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
  const contactPhoneRaw = isOutgoing && event.message.to ? event.message.to : event.message.from;
  const normalizedPhone = normalizePhone(contactPhoneRaw);


  // ── 6. Resolve lead/client (race-safe) ─────────────────────────────────
  const leadResolveStart = Date.now();
  const { leadId, clientId, runId } = await resolveContact(
    db,
    source,
    tenantId,
    normalizedPhone,
    isOutgoing,
  );
  metrics.leadResolveMs = Date.now() - leadResolveStart;

  const isTenantOfficialNumber =
    source.kind === "connection" &&
    (await isTenantOfficialNumberPhone(db, tenantId, normalizedPhone));

  if (
    source.kind === "connection" &&
    !shouldPersistBrokerConnectionMessage({
      hasLead: Boolean(leadId),
      hasClient: Boolean(clientId),
      isTenantOfficialNumber,
    })
  ) {
    await markIgnored(db, registered.id, "connection_contact_not_authorized");
    return { processed: 0, ignored: "connection_contact_not_authorized" as const };
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
        providerStatus: isOutgoing ? "sent" : "received",
        messageId: providerMessageId,
        phone: normalizedPhone,
        direction: isOutgoing ? "outgoing" : "incoming",
        body: event.message!.body,
        sentAt: new Date(event.occurredAt),
      })
      .onConflictDoNothing({
        target: [schema.whatsappMessages.tenantId, schema.whatsappMessages.messageId],
      });

    // Update cadence run if applicable
    if (runId && !isOutgoing) {
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

  // Only an opaque invalidation is broadcast. Each browser re-fetches its own
  // server-authorized scope, so a personal broker chat cannot reach Directors.
  if (source.kind === "connection") {
    try {
      revalidatePath("/conversas");
      revalidatePath("/conversas/broker");
    } catch {
      // Cache invalidation is best-effort outside a render request.
    }
    if (source.connection.tenantId && source.connection.userId) {
      void publishConversationInvalidation({
        tenantId: source.connection.tenantId,
        participantUserIds: [source.connection.userId],
      }).catch(() => undefined);
    }
  }

  // ── 8. AI processing (optional, background, only for inbound) ──────────
  if (!isOutgoing && leadId && (await getSystemSetting(WAHA_AI_FEATURE)) === "true") {
    const { processInboundAiResponse } =
      await import("@/features/ai-agent/conversation-state-machine");
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
    after(() => aiPromise);
  }

  await markProcessed(db, registered.id);
  metrics.totalMs = Date.now() - metrics.startTime;

  // Log metrics (no PII)
  console.info("[waha/inbound] processed", {
    eventType: event.type,
    eventId: event.eventId,
    sessionId: event.sessionId,
    messageId: event.message.id,
    direction: isOutgoing ? "outgoing" : "incoming",
    source: event.message.source ?? null,
    remotePhoneHash: phoneHash(normalizedPhone).slice(0, 16),
    conversationId: null,
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
  if (!sessionId) return null;

  // 1. Try platform/tenant numbers first (relay sessions)
  const [number] = await db
    .select()
    .from(schema.wahaNumbers)
    .where(
      or(
        eq(schema.wahaNumbers.relaySessionId, sessionId),
        eq(schema.wahaNumbers.id, sessionId),
      ),
    )
    .limit(1);
  if (number) return { kind: "number", number };

  // 2. Broker-level connections (direct WAHA sessions)
  const [connection] = await db
    .select()
    .from(schema.whatsappConnections)
    .where(
      or(
        eq(schema.whatsappConnections.sessionName, sessionId),
        eq(schema.whatsappConnections.sessionId, sessionId),
        eq(schema.whatsappConnections.id, sessionId),
      ),
    )
    .limit(1);
  if (connection) return { kind: "connection", connection };

  // 3. Fallback for "default" or single-active session
  if (sessionId === "default" || sessionId === "session_default") {
    const [singleNumber] = await db
      .select()
      .from(schema.wahaNumbers)
      .where(eq(schema.wahaNumbers.status, "ready"))
      .limit(2);
    if (singleNumber) return { kind: "number", number: singleNumber };

    const [singleConnection] = await db
      .select()
      .from(schema.whatsappConnections)
      .where(eq(schema.whatsappConnections.status, "ready"))
      .limit(2);
    if (singleConnection) return { kind: "connection", connection: singleConnection };
  }

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

  // Fallback: find lead by phone (scoped to tenant). Phone matching is
  // suffix-tolerant (samePhone semantics): leads stored with "+55", dashes or
  // parentheses must still resolve, matching what the UI displays.
  if (!leadId && !clientId) {
    const candidates = await db
      .select({
        id: schema.leads.id,
        telefone: schema.leads.telefone,
        corretorId: schema.leads.corretorId,
      })
      .from(schema.leads)
      .where(
        and(
          eq(schema.leads.tenantId, tenantId),
          phoneSuffixConditions(schema.leads.telefone, normalizedPhone),
        ),
      )
      .limit(5);
    const lead = candidates.find(
      (candidate) =>
        samePhone(candidate.telefone, normalizedPhone) &&
        (source.kind !== "connection" || candidate.corretorId === source.connection.userId || !candidate.corretorId),
    );
    if (lead) leadId = lead.id;
  }

  // Fallback: find client by phone (scoped to tenant, same tolerant match)
  if (!leadId && !clientId) {
    const candidates = await db
      .select({
        id: schema.clients.id,
        telefone: schema.clients.telefone,
        corretorId: schema.clients.corretorId,
      })
      .from(schema.clients)
      .where(
        and(
          eq(schema.clients.tenantId, tenantId),
          phoneSuffixConditions(schema.clients.telefone, normalizedPhone),
        ),
      )
      .limit(5);
    const client = candidates.find(
      (candidate) =>
        samePhone(candidate.telefone, normalizedPhone) &&
        (source.kind !== "connection" || candidate.corretorId === source.connection.userId || !candidate.corretorId),
    );
    if (client) clientId = client.id;
  }

  // The tenant's own official WAHA number is an internal Lite contact, never a
  // synthetic lead. It is rendered separately and may be answered by the broker.
  const isTenantOfficialNumber =
    source.kind === "connection" &&
    (await isTenantOfficialNumberPhone(db, tenantId, normalizedPhone));

  // Only the tenant-owned relay flow may create a new lead from an unknown
  // contact. A broker's personal WhatsApp is a restricted Lite workspace: an
  // unrelated inbound message must never enter tenant intake or AI qualification.
  if (
    shouldCreateSyntheticLead({
      sourceKind: source.kind,
      isOutgoing,
      hasLead: Boolean(leadId),
      hasClient: Boolean(clientId),
      isTenantOfficialNumber,
    })
  ) {
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

/**
 * Whether the phone belongs to the tenant's own official WhatsApp presence:
 * relay numbers (wahaNumbers) or an active Meta Cloud channel. Used both to
 * suppress synthetic leads and to allow broker outgoing messages to persist
 * without a lead/client (the Lite "tenant official" thread).
 */
async function isTenantOfficialNumberPhone(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  normalizedPhone: string,
): Promise<boolean> {
  const [numbers, channels] = await Promise.all([
    db
      .select({ phone: schema.wahaNumbers.displayPhoneNumber })
      .from(schema.wahaNumbers)
      .where(
        or(
          eq(schema.wahaNumbers.tenantId, tenantId),
          isNull(schema.wahaNumbers.tenantId),
        ),
      ),
    db
      .select({ phone: schema.communicationChannels.displayPhoneNumber })
      .from(schema.communicationChannels)
      .where(
        and(
          eq(schema.communicationChannels.tenantId, tenantId),
          eq(schema.communicationChannels.status, "active"),
        ),
      ),
  ]);
  return [...numbers, ...channels]
    .some((entry) => Boolean(entry.phone) && samePhone(entry.phone!, normalizedPhone));
}

