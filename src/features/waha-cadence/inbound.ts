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
import { META_CLOUD_PROVIDER } from "@/features/communication-channels/types";
import { scheduleLeadConversationAnalysis } from "@/features/conversation-intelligence";
import { startServiceOnFirstMessage } from "@/features/leads/start-service-on-message";
import {
  phoneHash,
  normalizePhone,
  type WahaWebhookEvent,
  WAHA_AI_FEATURE,
  WAHA_CADENCE_FEATURE,
} from "./contract";
import { brazilNinthDigitVariant, contactNumberShape, phoneSubscriberSuffix, samePhoneSubscriber } from "./phone-matching";
import { storeWahaMessageMedia } from "./message-media";

type SessionSource =
  | { kind: "number"; number: typeof schema.wahaNumbers.$inferSelect }
  | { kind: "connection"; connection: typeof schema.whatsappConnections.$inferSelect };

export function shouldStartServiceFromOutgoingLeadMessage(input: {
  isOutgoing: boolean;
  sourceKind: SessionSource["kind"];
  hasLead: boolean;
  brokerId: string | null | undefined;
}) {
  return input.isOutgoing && input.sourceKind === "connection" && input.hasLead && Boolean(input.brokerId);
}

export function shouldCreateSyntheticLead(input: {
  sourceKind: SessionSource["kind"];
  isOutgoing: boolean;
  hasLead: boolean;
  hasClient: boolean;
  isTenantOfficialNumber: boolean;
  isBrokerOrTeam?: boolean;
}) {
  // Official WhatsApp inbound is history-only. Leads enter through the
  // governed intake/integration flow; an unknown first message must never
  // manufacture a synthetic lead that can reach automatic distribution.
  return false;
}

/**
 * A broker connection is a restricted workspace, not a tenant intake channel.
 * Persist only CRM contacts (leads/clients); personal and internal chats never
 * enter the tenant database through a broker's personal connection.
 */
export function shouldPersistBrokerConnectionMessage(input: {
  hasLead: boolean;
  hasClient: boolean;
}) {
  return input.hasLead || input.hasClient;
}



/**
 * SQL pre-filter for tolerant phone matching. Generates LIKE conditions on the
 * last 9 digits of the normalized incoming phone so candidates stored with
 * formatting, country codes or a stale DDD are retrieved; exact matching is
 * then confirmed in memory with `samePhoneSubscriber`.
 */
function phoneSuffixConditions(
  column: AnyPgColumn,
  normalizedPhone: string,
) {
  const last9 = phoneSubscriberSuffix(normalizedPhone);
  if (!last9) return eq(column, normalizedPhone);
  // Also the same Brazilian mobile with/without the 9th digit (DDD included).
  const variant = brazilNinthDigitVariant(normalizedPhone);
  return or(
    eq(column, normalizedPhone),
    like(column, `%${last9}`),
    variant ? like(column, `%${variant}`) : undefined,
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
      // Conexões de corretor usam "initializing" para o pareamento; a tabela
      // de números da plataforma mantém o vocabulário "connecting" do relay.
      connecting: source.kind === "connection" ? "initializing" : "connecting",
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

  // A contact WhatsApp only exposed as `@lid` (no phone mapping from the
  // relay) cannot be matched to a lead; flag it distinctly instead of letting
  // the LID digits pass for an unknown phone.
  if (event.message.contactLidUnresolved) {
    await markIgnored(db, registered.id, "unresolved_lid");
    return { processed: 0, ignored: "unresolved_lid" as const };
  }

  // Determine direction based on fromMe flag
  const isOutgoing = event.message.fromMe === true;
  const contactPhoneRaw = isOutgoing && event.message.to ? event.message.to : event.message.from;
  const normalizedPhone = normalizePhone(contactPhoneRaw);

  // The company number (WhatsApp da diretoria) is an internal channel with the
  // brokers: messages with anyone else are ignored and never become leads
  // (decided 25/09). Broker messages are kept, linked to no lead.
  if (source.kind === "number" && !shouldKeepTenantChannelMessage({ isBrokerOrTeam: await isBrokerOrTeamPhone(db, tenantId, normalizedPhone) })) {
    await markIgnored(db, registered.id, `tenant_channel_non_broker:${contactNumberShape(normalizedPhone)}`);
    return { processed: 0, ignored: "tenant_channel_non_broker" as const };
  }

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

  if (
    source.kind === "connection" &&
    !shouldPersistBrokerConnectionMessage({
      hasLead: Boolean(leadId),
      hasClient: Boolean(clientId),
    })
  ) {
    // The number's shape and who it belongs to (never the number itself)
    // tell a personal contact from a lead reply lost to a matching gap.
    const detail = await describeIgnoredBrokerContact(db, tenantId, source.connection.userId, normalizedPhone).catch(() => "desconhecido");
    await markIgnored(db, registered.id, `connection_contact_not_authorized:${contactNumberShape(normalizedPhone)}:${detail}`);
    return { processed: 0, ignored: "connection_contact_not_authorized" as const };
  }

  // ── 7. Persist message with dedup (transaction for race safety) ─────────
  const persistStart = Date.now();
  const providerMessageId = event.message.id;

  // Audio/image/video/document: keep the actual file (fetched through the
  // relay) so the conversation plays it instead of showing "[audio]".
  const messageRowId = randomUUID();
  const storedMedia = await storeWahaMessageMedia({
    tenantId,
    messageRowId,
    type: event.message.type,
    media: event.message.media,
  });

  await db.transaction(async (tx) => {
    // Insert message with dedup
    await tx
      .insert(schema.whatsappMessages)
      .values({
        id: messageRowId,
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
        ...(storedMedia ? {
          mediaKind: storedMedia.kind,
          mediaMimeType: storedMedia.mimeType,
          mediaFilename: storedMedia.filename,
          mediaSizeBytes: storedMedia.sizeBytes,
          mediaStorageKey: storedMedia.storageKey,
          mediaSha256: storedMedia.sha256,
        } : {}),
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

  if (shouldStartServiceFromOutgoingLeadMessage({
    isOutgoing,
    sourceKind: source.kind,
    hasLead: Boolean(leadId),
    brokerId: source.kind === "connection" ? source.connection.userId : null,
  }) && source.kind === "connection" && source.connection.userId && leadId) {
    try {
      await startServiceOnFirstMessage({
        tenantId,
        leadId,
        brokerId: source.connection.userId,
        branchId: null,
        trigger: "first_message",
      });
    } catch {
      console.warn("[waha-cadence] outgoing_lead_service_start_failed");
    }
  }
  metrics.persistMs = Date.now() - persistStart;

  // Invalidate cache and push realtime sync
  try {
    revalidatePath("/conversas");
    revalidatePath("/conversas/broker");
  } catch {
    // Cache invalidation is best-effort outside a render request.
  }
  if (source.kind === "connection" && source.connection.tenantId && source.connection.userId) {
    void publishConversationInvalidation({
      tenantId: source.connection.tenantId,
      participantUserIds: [source.connection.userId],
    }).catch(() => undefined);
  } else if (tenantId) {
    void publishConversationInvalidation({
      tenantId,
      participantUserIds: [],
    }).catch(() => undefined);
  }

  // ── 7.1 Agendar análise de inteligência conversacional com debounce de 60s ──
  if (leadId && tenantId) {
    scheduleLeadConversationAnalysis(leadId, tenantId);
  }

  // ── 8. AI processing (optional, background, only for inbound to relay numbers) ──────────
  if (!isOutgoing && source.kind === "number" && leadId && (await getSystemSetting(WAHA_AI_FEATURE)) === "true") {
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

  // 0. Comunicação interna com Corretores, Equipe ou Números da Empresa:
  // NUNCA deve virar lead nem acionar IA de qualificação.
  const isBrokerOrTeam = await isBrokerOrTeamPhone(db, tenantId, normalizedPhone);
  const isTenantOfficial = await isTenantOfficialNumberPhone(db, tenantId, normalizedPhone);

  if (isBrokerOrTeam || isTenantOfficial) {
    return { leadId: null, clientId: null, runId: null };
  }

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
        samePhoneSubscriber(candidate.telefone, normalizedPhone) &&
        (source.kind !== "connection" || candidate.corretorId === source.connection.userId),
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
        samePhoneSubscriber(candidate.telefone, normalizedPhone) &&
        (source.kind !== "connection" || candidate.corretorId === source.connection.userId),
    );
    if (client) clientId = client.id;
  }

  // Only the tenant-owned relay flow may create a new lead from an unknown
  // contact. A broker's personal WhatsApp is a restricted Lite workspace: an
  // unrelated inbound message must never enter tenant intake or AI qualification.
  if (
    shouldCreateSyntheticLead({
      sourceKind: source.kind,
      isOutgoing,
      hasLead: Boolean(leadId),
      hasClient: Boolean(clientId),
      isTenantOfficialNumber: isTenantOfficial,
      isBrokerOrTeam,
    })
  ) {
    const newLeadId = randomUUID();
    await db.insert(schema.leads).values({
      id: newLeadId,
      tenantId,
      corretorId: source.kind === "connection" ? source.connection.userId : undefined,
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

export type IgnoredBrokerContact = "proprio_corretor" | "lead_sem_corretor" | "lead_de_outro_corretor" | "nao_e_lead";

/**
 * Why a message on a broker's own WhatsApp was not kept. "proprio_corretor"
 * is the signature of the relay attributing an @lid reply to the broker;
 * "lead_sem_corretor" is a lead whose assignment was removed mid-conversation.
 */
export function classifyIgnoredBrokerContact(input: { isOwner: boolean; matchingLeadOwners: ReadonlyArray<string | null> }): IgnoredBrokerContact {
  if (input.isOwner) return "proprio_corretor";
  if (input.matchingLeadOwners.some((owner) => owner === null)) return "lead_sem_corretor";
  if (input.matchingLeadOwners.length) return "lead_de_outro_corretor";
  return "nao_e_lead";
}

async function describeIgnoredBrokerContact(db: ReturnType<typeof getDatabase>, tenantId: string, brokerUserId: string | null, normalizedPhone: string) {
  const [owner] = brokerUserId
    ? await db.select({ phone: schema.brokerProfiles.phone }).from(schema.brokerProfiles)
      .where(and(eq(schema.brokerProfiles.tenantId, tenantId), eq(schema.brokerProfiles.userId, brokerUserId))).limit(1)
    : [];
  const leads = await db.select({ telefone: schema.leads.telefone, corretorId: schema.leads.corretorId }).from(schema.leads)
    .where(and(eq(schema.leads.tenantId, tenantId), isNull(schema.leads.deletedAt), phoneSuffixConditions(schema.leads.telefone, normalizedPhone)))
    .limit(10);
  return classifyIgnoredBrokerContact({
    isOwner: Boolean(owner?.phone && samePhoneSubscriber(owner.phone, normalizedPhone)),
    matchingLeadOwners: leads.filter((lead) => samePhoneSubscriber(lead.telefone, normalizedPhone)).map((lead) => lead.corretorId),
  });
}

/** Company number (WhatsApp da diretoria): only conversations with brokers/team are kept. */
export function shouldKeepTenantChannelMessage(input: { isBrokerOrTeam: boolean }) {
  return input.isBrokerOrTeam;
}

async function markIgnored(db: ReturnType<typeof getDatabase>, eventId: string, code: string) {
  await db
    .update(schema.wahaWebhookEvents)
    .set({ status: "ignored", errorCode: code, processedAt: new Date() })
    .where(eq(schema.wahaWebhookEvents.id, eventId));
}

/**
 * Whether the phone belongs to a broker or team member in the tenant.
 */
export async function isBrokerOrTeamPhone(
  db: ReturnType<typeof getDatabase>,
  tenantId: string,
  normalizedPhone: string,
): Promise<boolean> {
  const brokers = await db
    .select({ phone: schema.brokerProfiles.phone })
    .from(schema.brokerProfiles)
    .where(eq(schema.brokerProfiles.tenantId, tenantId));

  return brokers
    .some((entry) => Boolean(entry.phone) && samePhoneSubscriber(entry.phone!, normalizedPhone));
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
    .some((entry) => Boolean(entry.phone) && samePhoneSubscriber(entry.phone!, normalizedPhone));
}

