import "server-only";

import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { chooseAvailableBroker } from "@/features/leads/assignment";
import { notifyNewLead, notifyLeadArrived } from "@/features/notifications/send-push-helper";
import { enqueueLeadDistributionJob } from "@/features/lead-distribution/jobs";
import { startAiQualificationForLead } from "@/features/ai-qualification/service";
import { lpFormPayloadSchema } from "../schemas/lp-form-payload.schema";
import {
  hashNormalizedWebhookPayload,
  normalizeLeadName,
  normalizeLeadPhone,
  normalizeLeadEmail,
} from "../utils/lead-webhook.utils";
import { resolveLeadWebhookIdempotency } from "./resolve-lead-webhook-idempotency";
import { resolveWebhookBranch, WebhookBranchNotFoundError } from "./resolve-webhook-branch";
import type { ReceiveLeadWebhookResult } from "../types/lead-webhook.types";

export type CreateLeadFromWebhookSyncInput = {
  tenantId: string;
  branchId: string | null;
  credentialId: string;
  createdByUserId: string;
  payload: unknown;
  idempotencyKey: string | null;
  requestMetadata: {
    requestId: string;
    userAgent: string | null;
    receivedAt: Date;
  };
};

/**
 * Creates a lead from a landing page webhook submission.
 *
 * Everything runs synchronously in the same request:
 * 1. Validate + honeypot check
 * 2. Idempotency check
 * 3. Branch resolution
 * 4. Lead INSERT + beneficiary INSERT (same transaction)
 * 5. Distribution (round-robin) — synchronous
 * 6. Push notification — synchronous
 * 7. Audit + delivery record
 *
 * This guarantees the lead appears in the broker's queue instantly via
 * Supabase Realtime (the INSERT fires the logical replication immediately).
 */
export async function createLeadFromWebhookSync(
  input: CreateLeadFromWebhookSyncInput,
): Promise<ReceiveLeadWebhookResult> {
  const { tenantId, credentialId, createdByUserId, payload, idempotencyKey, requestMetadata } = input;
  const { requestId, receivedAt } = requestMetadata;
  const db = getDatabase();

  // ── Step 1: Validate payload (LP form fields) ──────────────────────
  const parsed = lpFormPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    const deliveryId = randomUUID();
    try {
      const payloadHash = hashNormalizedWebhookPayload(
        typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>) : {},
      );
      await db.insert(schema.webhookDeliveries).values({
        id: deliveryId, tenantId, credentialId, requestId, idempotencyKey: idempotencyKey ?? null,
        externalId: null, payloadHash, status: "rejected", errorCode: "INVALID_PAYLOAD", receivedAt,
      });
    } catch { /* non-critical */ }
    return {
      success: false, code: "INVALID_PAYLOAD",
      issues: parsed.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    };
  }

  const data = parsed.data;

  // ── Step 2: Honeypot check ─────────────────────────────────────────
  if (data.website && data.website.trim().length > 0) {
    // Bot detected — silently discard, respond 200 to not tip off the bot
    return { success: true, leadId: "honeypot-discarded", duplicate: false };
  }

  // ── Step 3: Normalize ──────────────────────────────────────────────
  const normalizedName = normalizeLeadName(data.nome);
  const normalizedPhone = normalizeLeadPhone(data.telefone);
  const normalizedEmail = normalizeLeadEmail(data.email);

  // ── Step 4: Resolve branch ─────────────────────────────────────────
  let branchId: string | null = null;
  try {
    branchId = input.branchId ?? await resolveWebhookBranch(tenantId, null);
  } catch (error) {
    if (error instanceof WebhookBranchNotFoundError) {
      const deliveryId = randomUUID();
      try {
        const payloadHash = hashNormalizedWebhookPayload(parsed.data as Record<string, unknown>);
        await db.insert(schema.webhookDeliveries).values({
          id: deliveryId, tenantId, credentialId, requestId, idempotencyKey: idempotencyKey ?? null,
          externalId: null, payloadHash, status: "rejected", errorCode: "BRANCH_NOT_FOUND", receivedAt,
        });
      } catch { /* non-critical */ }
      return { success: false, code: "BRANCH_NOT_FOUND" };
    }
    throw error;
  }

  // ── Step 5: Idempotency check ──────────────────────────────────────
  const payloadHash = hashNormalizedWebhookPayload(parsed.data as Record<string, unknown>);
  const idempotency = await resolveLeadWebhookIdempotency(credentialId, idempotencyKey, null, payloadHash);

  if (idempotency.status === "replay") {
    return { success: true, leadId: idempotency.leadId, duplicate: true };
  }
  if (idempotency.status === "conflict") {
    return { success: false, code: "IDEMPOTENCY_CONFLICT" };
  }

  // ── Step 6: Create delivery record ─────────────────────────────────
  const deliveryId = randomUUID();
  await db.insert(schema.webhookDeliveries).values({
    id: deliveryId, tenantId, credentialId, requestId, idempotencyKey: idempotencyKey ?? null,
    externalId: null, payloadHash, status: "received", receivedAt,
  });

  // ── Step 7: Distribute FIRST (synchronous round-robin) ─────────────
  // This MUST happen before the INSERT so the lead is born with corretor_id set.
  // The Realtime event then fires with the correct corretor_id.
  const corretorId = await chooseAvailableBroker(tenantId, branchId, undefined, credentialId);
  const assigned = Boolean(corretorId);

  // ── Step 8: Create lead + beneficiary in a single transaction ──────
  const leadId = randomUUID();
  const now = new Date();

  await db.transaction(async (tx) => {
    // INSERT lead with corretor_id already set
    await tx.insert(schema.leads).values({
      id: leadId,
      tenantId,
      branchId,
      corretorId,
      nome: normalizedName,
      telefone: normalizedPhone,
      email: normalizedEmail,
      origem: "webhook",
      distributionOrigin: "landing-page",
      status: assigned ? "distributed" : "new",
      distributionStatus: assigned ? "assigned" : branchId ? "queued" : "unassigned",
      assignmentSource: assigned ? "automatic" : null,
      assignmentStrategy: assigned ? "capacity" : null,
      assignedAt: assigned ? now : null,
      consentimentoLgpd: false,
      webhookCredentialId: credentialId,
      createdAt: now,
    });

    // A landing page does not collect a birth date. Do not persist a fictitious
    // beneficiary: age-dependent quotes must wait for the broker to collect it.
  });

  // ── Step 9: Audit + interaction + delivery status (same request) ───
  await db.transaction(async (tx) => {
    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId,
      userId: createdByUserId,
      tipo: "note",
      conteudo: assigned
        ? "Lead recebido via landing page e distribuído automaticamente para um corretor disponível."
        : "Lead recebido via landing page; aguardando corretor disponível.",
    });

    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: createdByUserId,
      entidade: "lead",
      entidadeId: leadId,
      acao: "lead.webhook.received",
    });

    await tx
      .update(schema.webhookDeliveries)
      .set({ status: "processed", leadId, processedAt: new Date() })
      .where(eq(schema.webhookDeliveries.id, deliveryId));
  });

  // ── Step 10: Enqueue distribution job if lead was queued ───────────
  if (!assigned && branchId) {
    await enqueueLeadDistributionJob({ tenantId, leadId }).catch(() => {});
  }

  // ── Step 11: Push notifications (synchronous) ───────────────────────
  await Promise.all([
    notifyLeadArrived(leadId, tenantId, branchId, normalizedName),
    notifyNewLead(leadId, tenantId, branchId, corretorId, normalizedName),
  ]);

  // The assistant is deliberately best-effort: a disabled/misconfigured AI or
  // WhatsApp channel must never make the lead webhook fail.
  await startAiQualificationForLead({ tenantId, leadId, actorUserId: createdByUserId }).catch((error) => {
    console.error("[ai-qualification] start deferred", { tenantId, leadId, error: error instanceof Error ? error.message : "unknown" });
  });

  return { success: true, leadId, duplicate: false };
}
