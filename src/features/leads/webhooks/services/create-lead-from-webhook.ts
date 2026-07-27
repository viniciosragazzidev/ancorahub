import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";
import { eq } from "drizzle-orm";

import type { NormalizedLeadData } from "../types/lead-webhook.types";
import { chooseAvailableBroker } from "@/features/leads/assignment";
import { notifyNewLead, notifyLeadArrived } from "@/features/notifications/send-push-helper";

export type CreateLeadFromWebhookInput = {
  tenantId: string;
  branchId: string | null;
  credentialId: string;
  createdByUserId: string;
  normalized: NormalizedLeadData;
  deliveryId: string;
};

export async function createLeadFromWebhook(
  input: CreateLeadFromWebhookInput,
): Promise<{ leadId: string }> {
  const leadId = randomUUID();
  const { tenantId, normalized, credentialId, createdByUserId, deliveryId, branchId } = input;
  const now = new Date();

  // ── Step 1: INSERT lead directly via Drizzle (direct Postgres) ──────
  // Direct Postgres bypasses RLS and the Supabase API gateway — lowest
  // possible latency. Supabase Realtime (logical replication) fires
  // regardless of the INSERT method.
  const db = getDatabase();
  await db.insert(schema.leads).values({
    id: leadId,
    tenantId,
    branchId,
    nome: normalized.name,
    telefone: normalized.phone,
    email: normalized.email,
    origem: "webhook",
    distributionOrigin: normalized.source,
    externalId: normalized.externalId,
    webhookCredentialId: credentialId,
    status: "new",
    distributionStatus: branchId ? "queued" : "unassigned",
    consentimentoLgpd: false,
    createdAt: now,
  });

  // ── Step 2: Everything else runs in background (fire-and-forget) ───
  // Distribution, audit, interaction, push — none of these block the response.
  void backgroundTasks({
    leadId,
    tenantId,
    branchId,
    credentialId,
    createdByUserId,
    deliveryId,
    normalized,
  }).catch((error) => {
    console.error("[webhook] background task error:", error);
  });

  return { leadId };
}

async function backgroundTasks(input: {
  leadId: string;
  tenantId: string;
  branchId: string | null;
  credentialId: string;
  createdByUserId: string;
  deliveryId: string;
  normalized: NormalizedLeadData;
}) {
  const { leadId, tenantId, branchId, credentialId, createdByUserId, deliveryId, normalized } = input;
  const db = getDatabase();

  // ── Distribute to available broker ──────────────────────────────────
  const corretorId = await chooseAvailableBroker(tenantId, branchId, undefined, credentialId);
  const assigned = Boolean(corretorId);

  // ── Update lead with distribution result ────────────────────────────
  await db
    .update(schema.leads)
    .set({
      corretorId,
      status: assigned ? "distributed" : "new",
      distributionStatus: assigned ? "assigned" : branchId ? "queued" : "unassigned",
      assignmentSource: assigned ? "automatic" : null,
      assignmentStrategy: assigned ? "capacity" : null,
      distributionUpdatedAt: new Date(),
      assignedAt: assigned ? new Date() : null,
    })
    .where(eq(schema.leads.id, leadId));

  // ── Audit + interaction + delivery status ───────────────────────────
  await db.transaction(async (tx) => {
    await tx.insert(schema.leadInteractions).values({
      id: randomUUID(),
      leadId,
      userId: createdByUserId,
      tipo: "note",
      conteudo: assigned
        ? "Lead recebido por webhook e distribuído automaticamente para um corretor disponível."
        : "Lead recebido por webhook; aguardando corretor disponível.",
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

  // ── Push notifications ──────────────────────────────────────────────
  await Promise.all([
    notifyLeadArrived(leadId, tenantId, branchId, normalized.name),
    notifyNewLead(leadId, tenantId, branchId, corretorId, normalized.name),
  ]);
}
