import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import { startAiQualificationForLead } from "@/features/ai-qualification/service";
import { getSystemSetting } from "@/features/system-settings/queries";
import { getDatabase, schema } from "@/shared/db";

import { lpFormPayloadSchema } from "../schemas/lp-form-payload.schema";
import type { ReceiveLeadWebhookResult } from "../types/lead-webhook.types";
import { hashNormalizedWebhookPayload, normalizeLeadEmail, normalizeLeadName, normalizeLeadPhone } from "../utils/lead-webhook.utils";
import { enqueueLeadEffect, enqueueLeadEffectTx } from "./lead-effect-outbox";
import { resolveLeadWebhookIdempotency } from "./resolve-lead-webhook-idempotency";
import { resolveWebhookBranch, WebhookBranchNotFoundError } from "./resolve-webhook-branch";

export type CreateLeadFromWebhookSyncInput = {
  tenantId: string;
  branchId: string | null;
  credentialId: string;
  createdByUserId: string;
  payload: unknown;
  idempotencyKey: string | null;
  requestMetadata: { requestId: string; userAgent: string | null; receivedAt: Date };
  leadSource?: {
    channel: string;
    externalId: string;
    campaign?: string | null;
    ad?: string | null;
    form?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  };
};

/**
 * Commits the lead and all required operational intent together. Provider work
 * is intentionally deferred to the durable outbox, never run in this request.
 */
export async function createLeadFromWebhookSync(input: CreateLeadFromWebhookSyncInput): Promise<ReceiveLeadWebhookResult> {
  const { tenantId, credentialId, createdByUserId, payload, idempotencyKey, requestMetadata } = input;
  const { requestId, receivedAt } = requestMetadata;
  const db = getDatabase();
  const parsed = lpFormPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    const payloadHash = hashNormalizedWebhookPayload(typeof payload === "object" && payload !== null ? payload as Record<string, unknown> : {});
    await db.insert(schema.webhookDeliveries).values({ id: randomUUID(), tenantId, credentialId, requestId, idempotencyKey, externalId: null, payloadHash, status: "rejected", errorCode: "INVALID_PAYLOAD", receivedAt }).onConflictDoNothing().catch(() => undefined);
    return { success: false, code: "INVALID_PAYLOAD", issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })) };
  }

  const data = parsed.data;
  if (data.website && data.website.trim().length > 0) return { success: true, leadId: "honeypot-discarded", duplicate: false };

  let branchId: string;
  try {
    const resolved = input.branchId ?? await resolveWebhookBranch(tenantId, null);
    if (!resolved) throw new WebhookBranchNotFoundError();
    branchId = resolved;
  } catch (error) {
    if (error instanceof WebhookBranchNotFoundError) {
      const payloadHash = hashNormalizedWebhookPayload(data as Record<string, unknown>);
      await db.insert(schema.webhookDeliveries).values({ id: randomUUID(), tenantId, credentialId, requestId, idempotencyKey, externalId: null, payloadHash, status: "rejected", errorCode: "BRANCH_NOT_FOUND", receivedAt }).onConflictDoNothing().catch(() => undefined);
      return { success: false, code: "BRANCH_NOT_FOUND" };
    }
    throw error;
  }

  const payloadHash = hashNormalizedWebhookPayload(data as Record<string, unknown>);
  const prior = await resolveLeadWebhookIdempotency(credentialId, idempotencyKey, null, payloadHash);
  if (prior.status === "replay") return { success: true, leadId: prior.leadId, duplicate: true };
  if (prior.status === "conflict") return { success: false, code: "IDEMPOTENCY_CONFLICT" };

  const normalizedName = normalizeLeadName(data.nome);
  const normalizedPhone = normalizeLeadPhone(data.telefone);
  const normalizedEmail = normalizeLeadEmail(data.email);
  const qualificationEngineEnabled = await getSystemSetting("feature_qualification_engine_enabled").then((value) => value === "true").catch(() => false);
  const leadId = randomUUID();
  const now = new Date();

  const committed = await db.transaction(async (tx) => {
    const deliveryId = randomUUID();
    const reservation = await tx.insert(schema.webhookDeliveries).values({
      id: deliveryId, tenantId, credentialId, requestId, idempotencyKey, externalId: null, payloadHash, status: "received", receivedAt,
    }).onConflictDoNothing().returning({ id: schema.webhookDeliveries.id });

    if (!reservation.length) {
      const [existing] = await tx.select({ leadId: schema.webhookDeliveries.leadId, payloadHash: schema.webhookDeliveries.payloadHash })
        .from(schema.webhookDeliveries)
        .where(and(eq(schema.webhookDeliveries.credentialId, credentialId), eq(schema.webhookDeliveries.idempotencyKey, idempotencyKey ?? "")))
        .limit(1);
      if (existing?.payloadHash === payloadHash && existing.leadId) return { duplicate: true as const, leadId: existing.leadId };
      return { conflict: true as const };
    }

    await tx.insert(schema.leads).values({
      id: leadId, tenantId, branchId, corretorId: null, nome: normalizedName, telefone: normalizedPhone, email: normalizedEmail,
      origem: "webhook", distributionOrigin: "landing-page", status: "new", distributionStatus: "queued",
      consentimentoLgpd: false, webhookCredentialId: credentialId, createdAt: now,
      ...(input.leadSource ? {
        externalId: input.leadSource.externalId,
        sourceChannel: input.leadSource.channel,
        sourceCampaign: input.leadSource.campaign ?? null,
        sourceAd: input.leadSource.ad ?? null,
        sourceForm: input.leadSource.form ?? null,
        sourceMetadata: input.leadSource.metadata ?? null,
        capturedAt: receivedAt,
      } : {}),
    });
    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(), leadId, userId: createdByUserId, tipo: "note",
      conteudo: "Lead recebido via landing page; distribuição e notificações foram registradas para processamento seguro.",
    });
    await tx.insert(schema.auditLogs).values({ id: randomUUID(), userId: createdByUserId, entidade: "lead", entidadeId: leadId, acao: "lead.webhook.received" });
    await tx.insert(schema.leadDistributionEvents).values({
      id: randomUUID(), tenantId, leadId, toBranchId: branchId, action: "queued", source: "webhook", strategy: "outbox",
      reason: "Lead recebido e aguardando distribuição idempotente.", actorId: createdByUserId, createdAt: now,
    });
    await tx.update(schema.webhookDeliveries).set({ status: "processed", leadId, processedAt: now }).where(eq(schema.webhookDeliveries.id, deliveryId));
    await enqueueLeadEffectTx(tx, { tenantId, leadId, webhookDeliveryId: deliveryId, type: "NOTIFY_LEAD_ARRIVED", idempotencyKey: `lead-intake:${deliveryId}:arrival`, payload: { branchId, leadName: normalizedName } });
    if (!qualificationEngineEnabled) {
      await enqueueLeadEffectTx(tx, { tenantId, leadId, webhookDeliveryId: deliveryId, type: "DISTRIBUTE_LEAD", idempotencyKey: `lead-intake:${deliveryId}:distribution`, payload: { branchId, leadName: normalizedName } });
    }
    return { duplicate: false as const, leadId };
  });

  if ("conflict" in committed) return { success: false, code: "IDEMPOTENCY_CONFLICT" };
  if (committed.duplicate) return { success: true, leadId: committed.leadId, duplicate: true };

  if (qualificationEngineEnabled) {
    const qualificationStart = await startAiQualificationForLead({ tenantId, leadId, actorUserId: createdByUserId }).catch(() => ({ started: false as const, reason: "failed" as const }));
    if (!qualificationStart.started) {
      await enqueueLeadEffect({ tenantId, leadId, type: "DISTRIBUTE_LEAD", idempotencyKey: `lead-intake:${leadId}:distribution-fallback`, payload: { branchId, leadName: normalizedName } }).catch(() => undefined);
    }
  }
  return { success: true, leadId, duplicate: false };
}
