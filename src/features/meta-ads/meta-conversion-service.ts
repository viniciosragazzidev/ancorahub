import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lte, min, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { decryptMetaToken } from "./meta-oauth";
import {
  buildMetaConversionEvent,
  isMetaConversionAuthError,
  isMetaConversionEventExpired,
  isMetaConversionRateLimit,
  isMetaLeadgenId,
  META_CONVERSION_EVENT_NAMES,
  META_CONVERSION_LEAD_SOURCE_CHANNEL,
  META_CONVERSION_MAX_AGE_MS,
  META_CONVERSION_MAX_ATTEMPTS,
  metaConversionEventId,
  metaConversionRetryDelayMs,
  resolveMetaConversionEventTime,
  serializeMetaConversionPayload,
  stagesForLeadState,
  stagesForQualificationStatus,
  type MetaConversionEvent,
  type MetaConversionStage,
} from "./meta-conversion-events";

/**
 * Conversions API for CRM (Conversion Leads). Lead stage changes are written
 * to meta_conversion_events (only for Lead Ads leads of tenants that turned it
 * on) and the meta-conversions job sends them to the tenant's dataset.
 */

const GRAPH_VERSION_PATTERN = /^v\d+\.\d+$/;
const SETTINGS_CACHE_MS = 60_000;
const SETTINGS_ERROR_CACHE_MS = 5 * 60_000;
const CLAIM_LEASE_MS = 10 * 60_000;
const RATE_LIMIT_PAUSE_MS = 15 * 60_000;
const MISSING_SETUP_PAUSE_MS = 30 * 60_000;
const MAX_EVENTS_PER_REQUEST = 500;
const RECONCILE_LEAD_LIMIT = 2000;
const ID_CHUNK = 500;

function graphVersion() {
  const configured = process.env.META_GRAPH_API_VERSION?.trim() || "v25.0";
  return GRAPH_VERSION_PATTERN.test(configured) ? configured : "v25.0";
}

function errorText(error: unknown) {
  return (error instanceof Error ? error.message : "Falha inesperada.").replace(/[\r\n]+/g, " ").slice(0, 300);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

// Enqueue runs inside hot lead paths (webhook, AI turn, sale). The on/off
// lookup is cached per process so a tenant with the feature off costs one
// query a minute, and a missing table (SQL not applied yet) is not retried
// on every lead.
const enabledCache = new Map<string, { enabled: boolean; expiresAt: number }>();

export function invalidateMetaConversionSettingsCache(tenantId: string) {
  enabledCache.delete(tenantId);
}

async function isMetaConversionsEnabled(tenantId: string) {
  const cached = enabledCache.get(tenantId);
  if (cached && cached.expiresAt > Date.now()) return cached.enabled;
  try {
    const [settings] = await getDatabase().select({ enabled: schema.metaConversionSettings.enabled })
      .from(schema.metaConversionSettings)
      .where(eq(schema.metaConversionSettings.tenantId, tenantId))
      .limit(1);
    const enabled = settings?.enabled === true;
    enabledCache.set(tenantId, { enabled, expiresAt: Date.now() + SETTINGS_CACHE_MS });
    return enabled;
  } catch (error) {
    console.warn("[meta-conversions] settings unavailable", { message: errorText(error).slice(0, 160) });
    enabledCache.set(tenantId, { enabled: false, expiresAt: Date.now() + SETTINGS_ERROR_CACHE_MS });
    return false;
  }
}

type EventRow = typeof schema.metaConversionEvents.$inferInsert;

function buildEventRow(input: {
  tenantId: string;
  leadId: string;
  metaLeadId: string;
  stage: MetaConversionStage;
  at: Date;
  leadCreatedAt: Date;
  now: Date;
}): EventRow {
  return {
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    stage: input.stage,
    eventName: META_CONVERSION_EVENT_NAMES[input.stage],
    eventId: metaConversionEventId(input.leadId, input.stage),
    metaLeadId: input.metaLeadId.trim(),
    eventTime: resolveMetaConversionEventTime({ at: input.at, leadCreatedAt: input.leadCreatedAt, now: input.now }),
    status: "pending",
    attempts: 0,
    nextAttemptAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

/**
 * Records that a lead reached one or more funnel stages. Idempotent (one row
 * per lead and stage), cheap when the tenant has the feature off, and it never
 * throws: a failure here must not break lead intake, qualification or sales.
 * Only Lead Ads leads (sourceChannel meta_lead_ads with a leadgen id) count.
 */
export async function enqueueMetaConversionEvent(input: {
  tenantId: string;
  leadId: string;
  stage: MetaConversionStage | MetaConversionStage[];
  at?: Date;
}): Promise<number> {
  const stages = Array.isArray(input.stage) ? input.stage : [input.stage];
  if (!stages.length) return 0;
  try {
    if (!(await isMetaConversionsEnabled(input.tenantId))) return 0;
    const db = getDatabase();
    const [lead] = await db.select({
      externalId: schema.leads.externalId,
      sourceChannel: schema.leads.sourceChannel,
      capturedAt: schema.leads.capturedAt,
      createdAt: schema.leads.createdAt,
      deletedAt: schema.leads.deletedAt,
    })
      .from(schema.leads)
      .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)))
      .limit(1);
    if (!lead || lead.deletedAt || lead.sourceChannel !== META_CONVERSION_LEAD_SOURCE_CHANNEL || !isMetaLeadgenId(lead.externalId)) return 0;
    const now = new Date();
    const rows = stages.map((stage) => buildEventRow({
      tenantId: input.tenantId,
      leadId: input.leadId,
      metaLeadId: lead.externalId!,
      stage,
      at: input.at ?? now,
      leadCreatedAt: lead.capturedAt ?? lead.createdAt,
      now,
    }));
    const inserted = await db.insert(schema.metaConversionEvents).values(rows).onConflictDoNothing().returning({ id: schema.metaConversionEvents.id });
    return inserted.length;
  } catch (error) {
    console.warn("[meta-conversions] enqueue skipped", { leadId: input.leadId, stages, message: errorText(error).slice(0, 160) });
    return 0;
  }
}

/** Qualification hook: warm records "Qualificado"; hot records "Qualificado" and "Quente". */
export async function enqueueMetaQualificationConversion(input: { tenantId: string; leadId: string; qualificationStatus: string | null | undefined; at?: Date }) {
  const stages = stagesForQualificationStatus(input.qualificationStatus);
  if (!stages.length) return 0;
  return enqueueMetaConversionEvent({ tenantId: input.tenantId, leadId: input.leadId, stage: stages, at: input.at });
}

/**
 * Enqueues every stage the tenant's Lead Ads leads of the last 7 days already
 * reached and that is not in the outbox yet. It is the backfill when the
 * director turns the feature on and, run by the job, the safety net for any
 * stage change that happened through a path without an explicit hook.
 */
export async function reconcileMetaConversionEvents(input: { tenantId: string; now?: Date }) {
  const db = getDatabase();
  const now = input.now ?? new Date();
  const since = new Date(now.getTime() - META_CONVERSION_MAX_AGE_MS);
  const leads = await db.select({
    id: schema.leads.id,
    externalId: schema.leads.externalId,
    capturedAt: schema.leads.capturedAt,
    createdAt: schema.leads.createdAt,
    status: schema.leads.status,
    qualificationStatus: schema.leads.qualificationStatus,
    qualificationCompletedAt: schema.leads.qualificationCompletedAt,
    stageEnteredAt: schema.leads.stageEnteredAt,
  })
    .from(schema.leads)
    .where(and(
      eq(schema.leads.tenantId, input.tenantId),
      eq(schema.leads.sourceChannel, META_CONVERSION_LEAD_SOURCE_CHANNEL),
      isNotNull(schema.leads.externalId),
      gte(schema.leads.createdAt, since),
      isNull(schema.leads.deletedAt),
    ))
    .orderBy(desc(schema.leads.createdAt))
    .limit(RECONCILE_LEAD_LIMIT);
  const eligible = leads.filter((lead) => isMetaLeadgenId(lead.externalId));
  if (!eligible.length) return 0;

  const saleAtByLead = new Map<string, Date>();
  const existing = new Set<string>();
  for (const ids of chunk(eligible.map((lead) => lead.id), ID_CHUNK)) {
    const [sales, events] = await Promise.all([
      db.select({ leadId: schema.sales.leadId, firstAt: min(schema.sales.createdAt) })
        .from(schema.sales)
        .where(and(eq(schema.sales.tenantId, input.tenantId), inArray(schema.sales.leadId, ids)))
        .groupBy(schema.sales.leadId),
      db.select({ leadId: schema.metaConversionEvents.leadId, stage: schema.metaConversionEvents.stage })
        .from(schema.metaConversionEvents)
        .where(and(eq(schema.metaConversionEvents.tenantId, input.tenantId), inArray(schema.metaConversionEvents.leadId, ids))),
    ]);
    for (const sale of sales) if (sale.firstAt) saleAtByLead.set(sale.leadId, sale.firstAt);
    for (const event of events) existing.add(`${event.leadId}:${event.stage}`);
  }

  const rows: EventRow[] = [];
  for (const lead of eligible) {
    const saleAt = saleAtByLead.get(lead.id);
    const stages = stagesForLeadState({ qualificationStatus: lead.qualificationStatus, status: lead.status, hasSale: Boolean(saleAt) });
    for (const stage of stages) {
      if (existing.has(`${lead.id}:${stage}`)) continue;
      const at = stage === "lead_received"
        ? lead.createdAt
        : stage === "sale"
          ? saleAt ?? lead.stageEnteredAt ?? now
          : lead.qualificationCompletedAt ?? now;
      rows.push(buildEventRow({
        tenantId: input.tenantId,
        leadId: lead.id,
        metaLeadId: lead.externalId!,
        stage,
        at,
        leadCreatedAt: lead.capturedAt ?? lead.createdAt,
        now,
      }));
    }
  }
  let inserted = 0;
  for (const part of chunk(rows, ID_CHUNK)) {
    const result = await db.insert(schema.metaConversionEvents).values(part).onConflictDoNothing().returning({ id: schema.metaConversionEvents.id });
    inserted += result.length;
  }
  return inserted;
}

type SendOutcome =
  | { ok: true; response: { events_received?: number; fbtrace_id?: string } }
  | { ok: false; rateLimited: boolean; auth: boolean; message: string };

async function postEvents(input: { datasetId: string; accessToken: string; events: MetaConversionEvent[]; testEventCode: string | null }): Promise<SendOutcome> {
  try {
    const response = await fetch(`https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(input.datasetId)}/events`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${input.accessToken}` },
      body: serializeMetaConversionPayload(input.events, input.testEventCode),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json().catch(() => ({})) as {
      events_received?: number;
      fbtrace_id?: string;
      error?: { message?: string; code?: number; error_subcode?: number; error_user_msg?: string };
    };
    if (response.ok && !payload.error) {
      return { ok: true, response: { events_received: payload.events_received, fbtrace_id: payload.fbtrace_id } };
    }
    const code = payload.error?.code;
    const detail = payload.error?.error_user_msg || payload.error?.message || `HTTP ${response.status}`;
    const auth = isMetaConversionAuthError(code);
    const message = auth
      ? `A Meta recusou o token da conexão para esta fonte de dados (código ${code}). Reconecte com a permissão ads_management ou use um token de usuário do sistema. ${detail}`
      : `Meta recusou o envio${code ? ` (código ${code})` : ""}: ${detail}`;
    return { ok: false, rateLimited: isMetaConversionRateLimit(code, response.status), auth, message: message.slice(0, 300) };
  } catch (error) {
    return { ok: false, rateLimited: false, auth: false, message: `Falha de rede ao enviar para a Meta: ${errorText(error)}`.slice(0, 300) };
  }
}

type ClaimedRow = typeof schema.metaConversionEvents.$inferSelect;

async function markSent(rows: ClaimedRow[], response: Record<string, unknown>, now: Date) {
  if (!rows.length) return;
  await getDatabase().update(schema.metaConversionEvents).set({
    status: "sent", sentAt: now, attempts: sql`${schema.metaConversionEvents.attempts} + 1`,
    lastError: null, response, updatedAt: now,
  }).where(inArray(schema.metaConversionEvents.id, rows.map((row) => row.id)));
}

async function markSkipped(rows: ClaimedRow[], reason: string, now: Date) {
  if (!rows.length) return;
  await getDatabase().update(schema.metaConversionEvents).set({ status: "skipped", lastError: reason, updatedAt: now })
    .where(inArray(schema.metaConversionEvents.id, rows.map((row) => row.id)));
}

/** Gives the rows back to the queue without spending an attempt (limits, missing setup). */
async function release(rows: ClaimedRow[], delayMs: number, reason: string | null, now: Date) {
  if (!rows.length) return;
  await getDatabase().update(schema.metaConversionEvents).set({
    nextAttemptAt: new Date(now.getTime() + delayMs), ...(reason ? { lastError: reason } : {}), updatedAt: now,
  }).where(and(inArray(schema.metaConversionEvents.id, rows.map((row) => row.id)), eq(schema.metaConversionEvents.status, "pending")));
}

/** Spends an attempt: back to pending with backoff, or failed after the last one. */
async function markAttemptFailed(rows: ClaimedRow[], message: string, now: Date) {
  let failed = 0;
  for (const row of rows) {
    const attempts = row.attempts + 1;
    const exhausted = attempts >= META_CONVERSION_MAX_ATTEMPTS;
    if (exhausted) failed += 1;
    await getDatabase().update(schema.metaConversionEvents).set({
      status: exhausted ? "failed" : "pending",
      attempts,
      nextAttemptAt: new Date(now.getTime() + metaConversionRetryDelayMs(attempts)),
      lastError: message,
      updatedAt: now,
    }).where(eq(schema.metaConversionEvents.id, row.id));
  }
  return failed;
}

export type MetaConversionSenderResult = {
  tenants: number;
  reconciled: number;
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
  skipped: number;
  rateLimited: boolean;
};

/**
 * Sends due rows to Meta, grouped by tenant/dataset. Events older than 7 days
 * become skipped; a rate limit leaves the rows pending and stops the run.
 */
export async function runMetaConversionSender(input: { limit?: number; now?: Date } = {}): Promise<MetaConversionSenderResult> {
  const db = getDatabase();
  const now = input.now ?? new Date();
  const result: MetaConversionSenderResult = { tenants: 0, reconciled: 0, claimed: 0, sent: 0, retried: 0, failed: 0, skipped: 0, rateLimited: false };
  const enabledSettings = await db.select({
    tenantId: schema.metaConversionSettings.tenantId,
    datasetId: schema.metaConversionSettings.datasetId,
    testEventCode: schema.metaConversionSettings.testEventCode,
  }).from(schema.metaConversionSettings).where(eq(schema.metaConversionSettings.enabled, true));
  result.tenants = enabledSettings.length;
  if (!enabledSettings.length) return result;

  for (const settings of enabledSettings) {
    result.reconciled += await reconcileMetaConversionEvents({ tenantId: settings.tenantId, now }).catch((error: unknown) => {
      console.warn("[meta-conversions] reconcile failed", { tenantId: settings.tenantId, message: errorText(error).slice(0, 160) });
      return 0;
    });
  }

  const tenantIds = enabledSettings.map((settings) => settings.tenantId);
  const candidates = await db.select({ id: schema.metaConversionEvents.id })
    .from(schema.metaConversionEvents)
    .where(and(
      eq(schema.metaConversionEvents.status, "pending"),
      lte(schema.metaConversionEvents.nextAttemptAt, now),
      inArray(schema.metaConversionEvents.tenantId, tenantIds),
    ))
    .orderBy(asc(schema.metaConversionEvents.createdAt))
    .limit(Math.min(Math.max(input.limit ?? 100, 1), 1000));
  if (!candidates.length) return result;

  // The lease moves next_attempt_at forward, so a concurrent run does not
  // claim the same rows (the WHERE is re-checked after the first commit).
  const claimed = await db.update(schema.metaConversionEvents)
    .set({ nextAttemptAt: new Date(now.getTime() + CLAIM_LEASE_MS), updatedAt: now })
    .where(and(
      inArray(schema.metaConversionEvents.id, candidates.map((row) => row.id)),
      eq(schema.metaConversionEvents.status, "pending"),
      lte(schema.metaConversionEvents.nextAttemptAt, now),
    ))
    .returning();
  result.claimed = claimed.length;

  const byTenant = new Map<string, ClaimedRow[]>();
  for (const row of claimed) byTenant.set(row.tenantId, [...(byTenant.get(row.tenantId) ?? []), row]);
  const settingsByTenant = new Map(enabledSettings.map((settings) => [settings.tenantId, settings]));
  const tenantQueue = [...byTenant.entries()];

  for (let tenantIndex = 0; tenantIndex < tenantQueue.length; tenantIndex += 1) {
    const [tenantId, rows] = tenantQueue[tenantIndex]!;
    const settings = settingsByTenant.get(tenantId);
    if (!settings?.datasetId) {
      await release(rows, MISSING_SETUP_PAUSE_MS, "Escolha a fonte de dados (dataset) da Meta na tela de integração.", now);
      continue;
    }
    const [connection] = await db.select({ accessTokenCiphertext: schema.metaConnections.accessTokenCiphertext })
      .from(schema.metaConnections)
      .where(and(eq(schema.metaConnections.tenantId, tenantId), eq(schema.metaConnections.status, "connected")))
      .orderBy(desc(schema.metaConnections.updatedAt))
      .limit(1);
    let accessToken: string | null = null;
    try {
      accessToken = connection ? decryptMetaToken(connection.accessTokenCiphertext) : null;
    } catch {
      accessToken = null;
    }
    if (!accessToken) {
      await release(rows, MISSING_SETUP_PAUSE_MS, "A conexão de Marketing da Meta não está ativa. Reconecte para retomar o envio.", now);
      continue;
    }

    const leads = await db.select({ id: schema.leads.id, telefone: schema.leads.telefone, email: schema.leads.email, deletedAt: schema.leads.deletedAt })
      .from(schema.leads)
      .where(and(eq(schema.leads.tenantId, tenantId), inArray(schema.leads.id, [...new Set(rows.map((row) => row.leadId))])));
    const leadById = new Map(leads.map((lead) => [lead.id, lead]));
    const expired: ClaimedRow[] = [];
    const removed: ClaimedRow[] = [];
    const ready: Array<{ row: ClaimedRow; event: MetaConversionEvent }> = [];
    for (const row of rows) {
      const lead = leadById.get(row.leadId);
      if (!lead || lead.deletedAt) { removed.push(row); continue; }
      if (isMetaConversionEventExpired(row.eventTime, now)) { expired.push(row); continue; }
      ready.push({
        row,
        event: buildMetaConversionEvent({
          stage: row.stage as MetaConversionStage,
          eventId: row.eventId,
          metaLeadId: row.metaLeadId,
          eventTime: row.eventTime,
          phone: lead.telefone,
          email: lead.email,
        }),
      });
    }
    await markSkipped(expired, "Evento com mais de 7 dias: a Meta não aceita mais.", now);
    await markSkipped(removed, "Lead apagado antes do envio.", now);
    result.skipped += expired.length + removed.length;

    for (const part of chunk(ready, MAX_EVENTS_PER_REQUEST)) {
      if (result.rateLimited) break;
      const send = (items: typeof part) => postEvents({ datasetId: settings.datasetId!, accessToken: accessToken!, events: items.map((item) => item.event), testEventCode: settings.testEventCode });
      const outcome = await send(part);
      if (outcome.ok) {
        await markSent(part.map((item) => item.row), outcome.response, now);
        result.sent += part.length;
        continue;
      }
      if (outcome.rateLimited) {
        result.rateLimited = true;
        break;
      }
      // One invalid event makes Meta refuse the whole request: retry one by
      // one so the valid events still go and only the bad one spends attempts.
      if (part.length > 1 && !outcome.auth) {
        for (const item of part) {
          if (result.rateLimited) break;
          const single = await send([item]);
          if (single.ok) {
            await markSent([item.row], single.response, now);
            result.sent += 1;
          } else if (single.rateLimited) {
            result.rateLimited = true;
          } else {
            const failed = await markAttemptFailed([item.row], single.message, now);
            result.failed += failed;
            result.retried += 1 - failed;
          }
        }
        continue;
      }
      const failed = await markAttemptFailed(part.map((item) => item.row), outcome.message, now);
      result.failed += failed;
      result.retried += part.length - failed;
    }

    if (result.rateLimited) {
      // Leave every claimed row that was not sent pending and stop the run.
      const pendingRows = tenantQueue.slice(tenantIndex).flatMap(([, tenantRows]) => tenantRows);
      await release(pendingRows, RATE_LIMIT_PAUSE_MS, "A Meta limitou as chamadas; o envio continua sozinho em alguns minutos.", now);
      break;
    }
  }
  return result;
}

export type MetaConversionsPanel = {
  available: boolean;
  enabled: boolean;
  datasetId: string | null;
  testEventCode: string | null;
  enabledAt: Date | null;
  counts: { pending: number; sent: number; failed: number; skipped: number };
  lastError: { message: string; at: Date } | null;
};

export async function getMetaConversionsPanel(tenantId: string): Promise<MetaConversionsPanel> {
  const empty: MetaConversionsPanel = { available: false, enabled: false, datasetId: null, testEventCode: null, enabledAt: null, counts: { pending: 0, sent: 0, failed: 0, skipped: 0 }, lastError: null };
  try {
    const db = getDatabase();
    const [[settings], grouped, [lastError]] = await Promise.all([
      db.select().from(schema.metaConversionSettings).where(eq(schema.metaConversionSettings.tenantId, tenantId)).limit(1),
      db.select({ status: schema.metaConversionEvents.status, total: count() })
        .from(schema.metaConversionEvents)
        .where(eq(schema.metaConversionEvents.tenantId, tenantId))
        .groupBy(schema.metaConversionEvents.status),
      db.select({ message: schema.metaConversionEvents.lastError, at: schema.metaConversionEvents.updatedAt })
        .from(schema.metaConversionEvents)
        .where(and(
          eq(schema.metaConversionEvents.tenantId, tenantId),
          inArray(schema.metaConversionEvents.status, ["pending", "failed"]),
          isNotNull(schema.metaConversionEvents.lastError),
        ))
        .orderBy(desc(schema.metaConversionEvents.updatedAt))
        .limit(1),
    ]);
    const counts = { ...empty.counts };
    for (const row of grouped) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = Number(row.total);
    }
    return {
      available: true,
      enabled: settings?.enabled === true,
      datasetId: settings?.datasetId ?? null,
      testEventCode: settings?.testEventCode ?? null,
      enabledAt: settings?.enabledAt ?? null,
      counts,
      lastError: lastError?.message ? { message: lastError.message, at: lastError.at } : null,
    };
  } catch (error) {
    console.warn("[meta-conversions] panel unavailable", { message: errorText(error).slice(0, 160) });
    return empty;
  }
}

/** Saves the tenant's switch, dataset and test code; turning it on runs the 7-day backfill. */
export async function saveMetaConversionSettings(input: {
  tenantId: string;
  userId: string;
  enabled: boolean;
  datasetId: string | null;
  testEventCode: string | null;
}) {
  const db = getDatabase();
  const now = new Date();
  const datasetId = input.datasetId?.trim() || null;
  const testEventCode = input.testEventCode?.trim() || null;
  if (testEventCode && !/^[A-Za-z0-9_-]{1,64}$/.test(testEventCode)) {
    throw new Error("Código de teste inválido. Copie o código da aba Testar eventos do Gerenciador de Eventos.");
  }
  if (input.enabled && !datasetId) throw new Error("Escolha a fonte de dados (dataset) que vai receber as etapas.");
  if (datasetId) {
    const [dataset] = await db.select({ id: schema.metaDatasets.id })
      .from(schema.metaDatasets)
      .where(and(eq(schema.metaDatasets.tenantId, input.tenantId), eq(schema.metaDatasets.datasetId, datasetId), eq(schema.metaDatasets.status, "active")))
      .limit(1);
    if (!dataset) throw new Error("Fonte de dados não encontrada. Sincronize a Meta e escolha de novo.");
  }

  const [current] = await db.select().from(schema.metaConversionSettings).where(eq(schema.metaConversionSettings.tenantId, input.tenantId)).limit(1);
  const turningOn = input.enabled && current?.enabled !== true;
  const values = {
    enabled: input.enabled,
    datasetId,
    testEventCode,
    enabledAt: turningOn ? now : current?.enabledAt ?? null,
    updatedBy: input.userId,
    updatedAt: now,
  };
  if (current) {
    await db.update(schema.metaConversionSettings).set(values).where(eq(schema.metaConversionSettings.id, current.id));
  } else {
    await db.insert(schema.metaConversionSettings).values({ id: randomUUID(), tenantId: input.tenantId, createdAt: now, ...values });
  }
  invalidateMetaConversionSettingsCache(input.tenantId);
  await db.insert(schema.auditLogs).values({
    id: randomUUID(), userId: input.userId, entidade: "meta_conversion_settings", entidadeId: input.tenantId,
    acao: input.enabled ? (turningOn ? "meta_conversions.enabled" : "meta_conversions.updated") : "meta_conversions.disabled",
    createdAt: now,
  });

  let backfilled = 0;
  if (turningOn) {
    backfilled = await reconcileMetaConversionEvents({ tenantId: input.tenantId, now });
    await db.update(schema.metaConversionSettings).set({ backfilledAt: now }).where(eq(schema.metaConversionSettings.tenantId, input.tenantId));
  }
  return { backfilled };
}
