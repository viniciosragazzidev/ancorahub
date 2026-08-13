import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";
import { z } from "zod";

import { notifyLeadArrived, notifyNewLead, publishNotification } from "@/features/notifications/send-push-helper";
import { getSystemSettings } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

const effectTypes = ["DISTRIBUTE_LEAD", "NOTIFY_LEAD_ARRIVED", "NOTIFY_LEAD_ASSIGNED", "ALERT_EXCEPTION"] as const;
const activeStatuses = ["pending", "retrying"] as const;

export type LeadEffectType = (typeof effectTypes)[number];
type EffectWriter = Pick<ReturnType<typeof getDatabase>, "insert">;

const payloadSchema = z.object({
  branchId: z.string().min(1).nullable().optional(),
  leadName: z.string().min(1).max(160).optional(),
  brokerId: z.string().min(1).optional(),
  failedEffectId: z.string().min(1).optional(),
  failedEffectType: z.enum(effectTypes).optional(),
}).strict();

const defaults = { enabled: true, maxAttempts: 8, retryBaseSeconds: 60, leaseSeconds: 120, batchSize: 25 };

function bounded(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function getLeadEffectOutboxConfig() {
  const settings = new Map((await getSystemSettings([
    "feature_lead_intake_outbox_enabled",
    "lead_intake_outbox_max_attempts",
    "lead_intake_outbox_retry_base_seconds",
    "lead_intake_outbox_lease_seconds",
  ])).map((setting) => [setting.key, setting.value]));
  return {
    enabled: settings.get("feature_lead_intake_outbox_enabled") !== "false",
    maxAttempts: bounded(settings.get("lead_intake_outbox_max_attempts"), defaults.maxAttempts, 1, 20),
    retryBaseSeconds: bounded(settings.get("lead_intake_outbox_retry_base_seconds"), defaults.retryBaseSeconds, 15, 3600),
    leaseSeconds: bounded(settings.get("lead_intake_outbox_lease_seconds"), defaults.leaseSeconds, 30, 900),
    batchSize: defaults.batchSize,
  };
}

export async function enqueueLeadEffectTx(writer: EffectWriter, input: {
  tenantId: string;
  leadId: string;
  webhookDeliveryId?: string | null;
  type: LeadEffectType;
  idempotencyKey: string;
  payload?: Record<string, string | null>;
  maxAttempts?: number;
}) {
  const now = new Date();
  await writer.insert(schema.leadEffectOutbox).values({
    id: randomUUID(), tenantId: input.tenantId, leadId: input.leadId,
    webhookDeliveryId: input.webhookDeliveryId ?? null, type: input.type,
    payload: input.payload ?? {}, idempotencyKey: input.idempotencyKey,
    maxAttempts: input.maxAttempts ?? defaults.maxAttempts, runAfter: now,
    createdAt: now, updatedAt: now,
  }).onConflictDoNothing();
}

export async function enqueueLeadEffect(input: Parameters<typeof enqueueLeadEffectTx>[1]) {
  await enqueueLeadEffectTx(getDatabase(), input);
}

function errorMessage(error: unknown) {
  return (error instanceof Error ? error.message : "Falha inesperada.").replace(/[\r\n]+/g, " ").slice(0, 240);
}

async function recoverExpiredLeases(now: Date, tenantId?: string, leadId?: string) {
  const result = await getDatabase().update(schema.leadEffectOutbox).set({
    status: "retrying", lockedAt: null, lockedBy: null, leaseExpiresAt: null, runAfter: now,
    lastErrorCode: "LEASE_EXPIRED", lastErrorMessage: "Execução recuperada após expiração do lease.", updatedAt: now,
  }).where(and(
    eq(schema.leadEffectOutbox.status, "processing"),
    lt(schema.leadEffectOutbox.leaseExpiresAt, now),
    tenantId ? eq(schema.leadEffectOutbox.tenantId, tenantId) : undefined,
    leadId ? eq(schema.leadEffectOutbox.leadId, leadId) : undefined,
  )).returning({ id: schema.leadEffectOutbox.id });
  return result.length;
}

async function claimNext(workerId: string, leaseSeconds: number, tenantId?: string, leadId?: string) {
  const now = new Date();
  const [candidate] = await getDatabase().select({ id: schema.leadEffectOutbox.id })
    .from(schema.leadEffectOutbox)
    .where(and(
      inArray(schema.leadEffectOutbox.status, [...activeStatuses]),
      lte(schema.leadEffectOutbox.runAfter, now),
      tenantId ? eq(schema.leadEffectOutbox.tenantId, tenantId) : undefined,
      leadId ? eq(schema.leadEffectOutbox.leadId, leadId) : undefined,
    ))
    .orderBy(asc(schema.leadEffectOutbox.runAfter), asc(schema.leadEffectOutbox.createdAt)).limit(1);
  if (!candidate) return null;
  const [claimed] = await getDatabase().update(schema.leadEffectOutbox).set({
    status: "processing", attemptCount: sql`${schema.leadEffectOutbox.attemptCount} + 1`, lockedAt: now,
    lockedBy: workerId, leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1000), updatedAt: now,
  }).where(and(
    eq(schema.leadEffectOutbox.id, candidate.id),
    inArray(schema.leadEffectOutbox.status, [...activeStatuses]),
    lte(schema.leadEffectOutbox.runAfter, now),
    tenantId ? eq(schema.leadEffectOutbox.tenantId, tenantId) : undefined,
    leadId ? eq(schema.leadEffectOutbox.leadId, leadId) : undefined,
  )).returning();
  return claimed ?? null;
}

async function notifyException(effect: typeof schema.leadEffectOutbox.$inferSelect) {
  const recipients = await getDatabase().select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, effect.tenantId), eq(schema.tenantMemberships.status, "active"), inArray(schema.tenantMemberships.role, ["director", "manager"])));
  await Promise.all(recipients.map(({ userId }) => publishNotification({
    capability: "lead_arrived", tenantId: effect.tenantId, recipientUserId: userId, leadId: effect.leadId,
    type: "lead.intake_exception", title: "Ação de lead exige revisão", message: "Uma ação automática não pôde ser concluída e foi enviada para a fila de exceções.",
    url: "/leads/distribuicao", tag: `lead-effect-exception-${effect.id}`,
    idempotencyKey: `lead-effect-exception:${effect.id}:${userId}`,
  })));
}

async function executeEffect(effect: typeof schema.leadEffectOutbox.$inferSelect) {
  const payload = payloadSchema.parse(effect.payload);
  if (effect.type === "DISTRIBUTE_LEAD") {
    const { enqueueLeadDistributionJob } = await import("@/features/lead-distribution/jobs");
    await enqueueLeadDistributionJob({ tenantId: effect.tenantId, leadId: effect.leadId });
    return;
  }
  if (effect.type === "NOTIFY_LEAD_ARRIVED") {
    await notifyLeadArrived(effect.leadId, effect.tenantId, payload.branchId ?? null, payload.leadName ?? "Novo lead", `lead-arrived:${effect.leadId}`);
    return;
  }
  if (effect.type === "NOTIFY_LEAD_ASSIGNED") {
    if (!payload.brokerId) throw new Error("NOTIFY_LEAD_ASSIGNED requer brokerId.");
    await notifyNewLead(effect.leadId, effect.tenantId, payload.branchId ?? null, payload.brokerId, payload.leadName ?? "Novo lead", `lead-assigned:${effect.id}`);
    return;
  }
  await notifyException(effect);
}

async function complete(effectId: string) {
  await getDatabase().update(schema.leadEffectOutbox).set({ status: "completed", completedAt: new Date(), lockedAt: null, lockedBy: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date() }).where(eq(schema.leadEffectOutbox.id, effectId));
}

async function retryOrFail(effect: typeof schema.leadEffectOutbox.$inferSelect, config: Awaited<ReturnType<typeof getLeadEffectOutboxConfig>>, error: unknown) {
  const now = new Date();
  const exhausted = effect.attemptCount >= effect.maxAttempts;
  await getDatabase().update(schema.leadEffectOutbox).set({
    status: exhausted ? "failed" : "retrying", failedAt: exhausted ? now : null,
    runAfter: exhausted ? now : new Date(now.getTime() + Math.min(config.retryBaseSeconds * (2 ** Math.max(effect.attemptCount - 1, 0)), 3600) * 1000),
    lockedAt: null, lockedBy: null, leaseExpiresAt: null,
    lastErrorCode: error instanceof z.ZodError ? "INVALID_OUTBOX_PAYLOAD" : "EFFECT_PROCESSING_ERROR",
    lastErrorMessage: errorMessage(error), updatedAt: now,
  }).where(eq(schema.leadEffectOutbox.id, effect.id));
  if (exhausted && effect.type !== "ALERT_EXCEPTION") {
    await enqueueLeadEffect({ tenantId: effect.tenantId, leadId: effect.leadId, type: "ALERT_EXCEPTION", idempotencyKey: `lead-effect-alert:${effect.id}`, payload: { failedEffectId: effect.id, failedEffectType: effect.type } });
  }
  return exhausted;
}

export async function runLeadEffectOutboxProcessor(input: { tenantId?: string; leadId?: string; limit?: number } = {}) {
  const config = await getLeadEffectOutboxConfig();
  const result = { recoveredLeases: 0, claimed: 0, completed: 0, retried: 0, failed: 0 };
  if (!config.enabled) return result;
  result.recoveredLeases = await recoverExpiredLeases(new Date(), input.tenantId, input.leadId);
  const workerId = `lead-effects:${randomUUID()}`;
  for (let index = 0; index < Math.min(input.limit ?? config.batchSize, config.batchSize); index += 1) {
    const effect = await claimNext(workerId, config.leaseSeconds, input.tenantId, input.leadId);
    if (!effect) break;
    result.claimed += 1;
    try {
      await executeEffect(effect);
      await complete(effect.id);
      result.completed += 1;
    } catch (error) {
      if (await retryOrFail(effect, config, error)) result.failed += 1;
      else result.retried += 1;
    }
  }
  return result;
}

export async function getLeadEffectOutboxHealth(tenantId?: string) {
  const rows = await getDatabase().select({ status: schema.leadEffectOutbox.status, total: sql<number>`count(*)` })
    .from(schema.leadEffectOutbox)
    .where(tenantId ? eq(schema.leadEffectOutbox.tenantId, tenantId) : undefined)
    .groupBy(schema.leadEffectOutbox.status);
  const counts = new Map(rows.map((row) => [row.status, Number(row.total)]));
  return { pending: counts.get("pending") ?? 0, retrying: counts.get("retrying") ?? 0, processing: counts.get("processing") ?? 0, failed: counts.get("failed") ?? 0, completed: counts.get("completed") ?? 0 };
}

export async function retryLeadEffectForTenant(input: { tenantId: string; effectId: string }) {
  const [effect] = await getDatabase().update(schema.leadEffectOutbox).set({ status: "pending", runAfter: new Date(), lockedAt: null, lockedBy: null, leaseExpiresAt: null, failedAt: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date() })
    .where(and(eq(schema.leadEffectOutbox.id, input.effectId), eq(schema.leadEffectOutbox.tenantId, input.tenantId), eq(schema.leadEffectOutbox.status, "failed"))).returning({ id: schema.leadEffectOutbox.id });
  return Boolean(effect);
}
