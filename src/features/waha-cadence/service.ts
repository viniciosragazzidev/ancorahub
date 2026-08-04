import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, lt, lte, sql } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { getSystemSettings } from "@/features/system-settings/queries";
import { sendWahaRelayMessage } from "./relay-client";
import { cadenceDefinitionSchema, phoneHash, type CadenceDefinition, WAHA_CADENCE_FEATURE } from "./contract";

type Actor = { userId: string; tenantId: string; role: "director" | "manager" | "broker"; branchId: string | null };
type Recipient = { type: "lead" | "client"; id: string };

const defaults = { maxAttempts: 5, retryBaseSeconds: 60, leaseSeconds: 120, batchSize: 20 };

function bounded(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

export async function getWahaCadenceConfig() {
  const rows = await getSystemSettings([WAHA_CADENCE_FEATURE, "waha_cadence_max_attempts", "waha_cadence_retry_base_seconds", "waha_cadence_lease_seconds"]);
  const values = new Map(rows.map((row) => [row.key, row.value]));
  return {
    enabled: values.get(WAHA_CADENCE_FEATURE) === "true",
    maxAttempts: bounded(values.get("waha_cadence_max_attempts"), defaults.maxAttempts, 1, 10),
    retryBaseSeconds: bounded(values.get("waha_cadence_retry_base_seconds"), defaults.retryBaseSeconds, 15, 3600),
    leaseSeconds: bounded(values.get("waha_cadence_lease_seconds"), defaults.leaseSeconds, 30, 900),
    batchSize: defaults.batchSize,
  };
}

function assertDirector(actor: Actor) {
  if (actor.role !== "director") throw new Error("Apenas o Diretor pode administrar cadências.");
}

async function audit(actor: Pick<Actor, "userId">, entity: string, entityId: string, action: string) {
  await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: actor.userId, entidade: entity, entidadeId: entityId, acao: action });
}

export async function createCadence(actor: Actor, input: { name: string; branchId?: string | null }) {
  assertDirector(actor);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new Error("Informe um nome entre 2 e 120 caracteres.");
  const id = randomUUID();
  await getDatabase().insert(schema.wahaCadences).values({ id, tenantId: actor.tenantId, branchId: input.branchId ?? null, name, createdBy: actor.userId });
  await audit(actor, "waha_cadence", id, "waha_cadence.created");
  return id;
}

export async function createCadenceDraft(actor: Actor, input: { cadenceId: string; wahaNumberId: string; definition: unknown }) {
  assertDirector(actor);
  const definition = cadenceDefinitionSchema.parse(input.definition);
  const db = getDatabase();
  const [cadence] = await db.select({ id: schema.wahaCadences.id }).from(schema.wahaCadences)
    .where(and(eq(schema.wahaCadences.id, input.cadenceId), eq(schema.wahaCadences.tenantId, actor.tenantId), inArray(schema.wahaCadences.status, ["draft", "paused", "active"]))).limit(1);
  if (!cadence) throw new Error("Cadência não encontrada.");
  const [number] = await db.select({ id: schema.wahaNumbers.id, status: schema.wahaNumbers.status }).from(schema.wahaNumbers)
    .where(eq(schema.wahaNumbers.id, input.wahaNumberId)).limit(1);
  if (!number || number.status !== "active") throw new Error("Selecione um número WAHA ativo da frota.");
  const rows = await db.select({ version: schema.wahaCadenceVersions.version }).from(schema.wahaCadenceVersions)
    .where(and(eq(schema.wahaCadenceVersions.cadenceId, cadence.id), eq(schema.wahaCadenceVersions.tenantId, actor.tenantId)));
  const version = Math.max(0, ...rows.map((row) => row.version)) + 1;
  const id = randomUUID();
  await db.insert(schema.wahaCadenceVersions).values({ id, cadenceId: cadence.id, tenantId: actor.tenantId, version, wahaNumberId: number.id, definition, createdBy: actor.userId });
  await audit(actor, "waha_cadence_version", id, "waha_cadence.draft_created");
  return id;
}

export async function publishCadenceVersion(actor: Actor, versionId: string) {
  assertDirector(actor);
  const db = getDatabase();
  const [version] = await db.select().from(schema.wahaCadenceVersions)
    .where(and(eq(schema.wahaCadenceVersions.id, versionId), eq(schema.wahaCadenceVersions.tenantId, actor.tenantId), eq(schema.wahaCadenceVersions.status, "draft"))).limit(1);
  if (!version) throw new Error("Versão em rascunho não encontrada.");
  cadenceDefinitionSchema.parse(version.definition);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.wahaCadenceVersions).set({ status: "superseded" }).where(and(eq(schema.wahaCadenceVersions.cadenceId, version.cadenceId), eq(schema.wahaCadenceVersions.status, "published")));
    await tx.update(schema.wahaCadenceVersions).set({ status: "published", publishedAt: now }).where(eq(schema.wahaCadenceVersions.id, version.id));
    await tx.update(schema.wahaCadences).set({ status: "active", activeVersionId: version.id, pausedAt: null, updatedAt: now }).where(and(eq(schema.wahaCadences.id, version.cadenceId), eq(schema.wahaCadences.tenantId, actor.tenantId)));
  });
  await audit(actor, "waha_cadence", version.cadenceId, "waha_cadence.published");
}

export async function pauseCadence(actor: Actor, cadenceId: string) {
  assertDirector(actor);
  const [updated] = await getDatabase().update(schema.wahaCadences).set({ status: "paused", pausedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.wahaCadences.id, cadenceId), eq(schema.wahaCadences.tenantId, actor.tenantId), eq(schema.wahaCadences.status, "active"))).returning({ id: schema.wahaCadences.id });
  if (!updated) throw new Error("Cadência ativa não encontrada.");
  await audit(actor, "waha_cadence", cadenceId, "waha_cadence.paused");
}

async function resolveRecipientPhone(tenantId: string, recipient: Recipient) {
  const db = getDatabase();
  if (recipient.type === "lead") {
    const [lead] = await db.select({ phone: schema.leads.telefone }).from(schema.leads).where(and(eq(schema.leads.id, recipient.id), eq(schema.leads.tenantId, tenantId))).limit(1);
    if (!lead?.phone) throw new Error("Lead sem telefone disponível.");
    return lead.phone;
  }
  const [client] = await db.select({ phone: schema.clients.telefone }).from(schema.clients).where(and(eq(schema.clients.id, recipient.id), eq(schema.clients.tenantId, tenantId))).limit(1);
  if (!client?.phone) throw new Error("Cliente sem telefone disponível.");
  return client.phone;
}

export async function startCadenceRun(actor: Actor, input: { cadenceId: string; recipient: Recipient }) {
  assertDirector(actor);
  const config = await getWahaCadenceConfig();
  if (!config.enabled) throw new Error("Cadência WAHA está desativada pela plataforma.");
  const db = getDatabase();
  const [cadence] = await db.select().from(schema.wahaCadences).where(and(eq(schema.wahaCadences.id, input.cadenceId), eq(schema.wahaCadences.tenantId, actor.tenantId), eq(schema.wahaCadences.status, "active"))).limit(1);
  if (!cadence?.activeVersionId) throw new Error("Cadência sem versão publicada.");
  const [version] = await db.select().from(schema.wahaCadenceVersions).where(and(eq(schema.wahaCadenceVersions.id, cadence.activeVersionId), eq(schema.wahaCadenceVersions.tenantId, actor.tenantId), eq(schema.wahaCadenceVersions.status, "published"))).limit(1);
  if (!version?.wahaNumberId) throw new Error("Versão sem número WAHA ativo.");
  const phone = await resolveRecipientPhone(actor.tenantId, input.recipient);
  const hash = phoneHash(phone);
  const [suppression] = await db.select({ id: schema.wahaSuppressions.id }).from(schema.wahaSuppressions).where(eq(schema.wahaSuppressions.phoneHash, hash)).limit(1);
  if (suppression) throw new Error("Este contato solicitou não receber mensagens automáticas.");
  const runId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(schema.wahaCadenceRuns).values({ id: runId, tenantId: actor.tenantId, cadenceId: cadence.id, versionId: version.id, wahaNumberId: version.wahaNumberId!, recipientType: input.recipient.type, recipientId: input.recipient.id, contactPhoneHash: hash, status: "queued", nextActionAt: new Date() });
    await tx.insert(schema.wahaDeliveryOutbox).values({ id: randomUUID(), tenantId: actor.tenantId, runId, wahaNumberId: version.wahaNumberId!, stepIndex: 0, idempotencyKey: `waha-run:${runId}:step:0`, maxAttempts: config.maxAttempts });
  });
  await audit(actor, "waha_cadence_run", runId, "waha_cadence.run_started");
  return runId;
}

/** Queues an AI reply in the same durable relay outbox as cadence steps. */
export async function enqueueWahaAiReply(input: { tenantId: string; runId: string; body: string }) {
  const db = getDatabase();
  const [run] = await db.select().from(schema.wahaCadenceRuns).where(and(eq(schema.wahaCadenceRuns.id, input.runId), eq(schema.wahaCadenceRuns.tenantId, input.tenantId))).limit(1);
  if (!run) throw new Error("Execução WAHA não encontrada para a resposta da IA.");
  const body = input.body.trim();
  if (!body || body.length > 1_000) throw new Error("Resposta de IA inválida para WAHA.");
  const id = randomUUID();
  await db.insert(schema.wahaDeliveryOutbox).values({
    id,
    tenantId: input.tenantId,
    runId: run.id,
    wahaNumberId: run.wahaNumberId,
    stepIndex: -1,
    kind: "ai_reply",
    messageBody: body,
    idempotencyKey: `waha-ai:${run.id}:${id}`,
  });
  return id;
}

function cadenceCanSendNow(definition: CadenceDefinition, now: Date) {
  const day = now.getDay();
  const hour = now.getHours();
  return definition.schedule.weekdays.includes(day) && hour >= definition.schedule.startHour && hour < definition.schedule.endHour;
}

async function claimNext(workerId: string, leaseSeconds: number) {
  const db = getDatabase();
  const now = new Date();
  const [candidate] = await db.select({ id: schema.wahaDeliveryOutbox.id }).from(schema.wahaDeliveryOutbox)
    .where(and(inArray(schema.wahaDeliveryOutbox.status, ["pending", "retrying"]), lte(schema.wahaDeliveryOutbox.runAfter, now))).orderBy(asc(schema.wahaDeliveryOutbox.runAfter), asc(schema.wahaDeliveryOutbox.createdAt)).limit(1);
  if (!candidate) return null;
  const [claimed] = await db.update(schema.wahaDeliveryOutbox).set({ status: "processing", attemptCount: sql`${schema.wahaDeliveryOutbox.attemptCount} + 1`, lockedAt: now, lockedBy: workerId, leaseExpiresAt: new Date(now.getTime() + leaseSeconds * 1_000), updatedAt: now })
    .where(and(eq(schema.wahaDeliveryOutbox.id, candidate.id), inArray(schema.wahaDeliveryOutbox.status, ["pending", "retrying"]))).returning();
  return claimed ?? null;
}

async function processDelivery(row: typeof schema.wahaDeliveryOutbox.$inferSelect, config: Awaited<ReturnType<typeof getWahaCadenceConfig>>) {
  const db = getDatabase();
  const [run] = await db.select().from(schema.wahaCadenceRuns).where(and(eq(schema.wahaCadenceRuns.id, row.runId), eq(schema.wahaCadenceRuns.tenantId, row.tenantId), inArray(schema.wahaCadenceRuns.status, ["queued", "active"]))).limit(1);
  if (!run) throw new Error("Execução não está disponível.");
  const [version] = await db.select().from(schema.wahaCadenceVersions).where(and(eq(schema.wahaCadenceVersions.id, run.versionId), eq(schema.wahaCadenceVersions.tenantId, row.tenantId), eq(schema.wahaCadenceVersions.status, "published"))).limit(1);
  const [number] = await db.select().from(schema.wahaNumbers).where(and(eq(schema.wahaNumbers.id, row.wahaNumberId), eq(schema.wahaNumbers.status, "active"))).limit(1);
  if (!version || !number) throw new Error("Versão ou número WAHA indisponível.");
  const definition = cadenceDefinitionSchema.parse(version.definition);
  const step = row.kind === "ai_reply" ? null : definition.steps[row.stepIndex];
  if (!step && row.kind !== "ai_reply") throw new Error("Etapa da cadência não encontrada.");
  const body = row.messageBody ?? step?.body;
  if (!body) throw new Error("Mensagem WAHA não encontrada.");
  const phone = await resolveRecipientPhone(row.tenantId, { type: run.recipientType as Recipient["type"], id: run.recipientId });
  const [suppression] = await db.select({ id: schema.wahaSuppressions.id }).from(schema.wahaSuppressions).where(eq(schema.wahaSuppressions.phoneHash, phoneHash(phone))).limit(1);
  if (suppression) throw new Error("Contato suprimido.");
  if (!cadenceCanSendNow(definition, new Date())) {
    await db.update(schema.wahaDeliveryOutbox).set({ status: "pending", runAfter: new Date(Date.now() + 60 * 60 * 1_000), lockedAt: null, lockedBy: null, leaseExpiresAt: null, updatedAt: new Date() }).where(eq(schema.wahaDeliveryOutbox.id, row.id));
    return "deferred" as const;
  }
  const sent = await sendWahaRelayMessage({ idempotencyKey: row.idempotencyKey, sessionId: number.relaySessionId, destination: phone.replace(/\D/g, ""), body });
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(schema.wahaDeliveryOutbox).set({ status: "sent", providerMessageId: sent.messageId, completedAt: now, lockedAt: null, lockedBy: null, leaseExpiresAt: null, updatedAt: now }).where(eq(schema.wahaDeliveryOutbox.id, row.id));
    await tx.update(schema.wahaCadenceRuns).set({ status: "active", currentStep: row.kind === "ai_reply" ? run.currentStep : row.stepIndex, nextActionAt: row.kind === "ai_reply" ? run.nextActionAt : new Date(now.getTime() + (step?.waitMinutesAfter ?? 0) * 60_000), updatedAt: now }).where(eq(schema.wahaCadenceRuns.id, run.id));
  });
  return "sent" as const;
}

export async function runWahaCadenceProcessor(input: { limit?: number } = {}) {
  const config = await getWahaCadenceConfig();
  const result = { claimed: 0, sent: 0, deferred: 0, retried: 0, failed: 0 };
  if (!config.enabled) return result;
  const workerId = `waha:${randomUUID()}`;
  for (let index = 0; index < Math.min(input.limit ?? config.batchSize, config.batchSize); index += 1) {
    const row = await claimNext(workerId, config.leaseSeconds);
    if (!row) break;
    result.claimed += 1;
    try {
      const outcome = await processDelivery(row, config);
      if (outcome === "sent") result.sent += 1; else result.deferred += 1;
    } catch (error) {
      const exhausted = row.attemptCount >= row.maxAttempts;
      await getDatabase().update(schema.wahaDeliveryOutbox).set({ status: exhausted ? "failed" : "retrying", failedAt: exhausted ? new Date() : null, runAfter: exhausted ? new Date() : new Date(Date.now() + Math.min(config.retryBaseSeconds * 2 ** Math.max(row.attemptCount - 1, 0), 3600) * 1_000), lockedAt: null, lockedBy: null, leaseExpiresAt: null, lastErrorCode: error instanceof Error ? error.message.slice(0, 120) : "delivery_failed", updatedAt: new Date() }).where(eq(schema.wahaDeliveryOutbox.id, row.id));
      if (exhausted) result.failed += 1; else result.retried += 1;
    }
  }
  return result;
}
