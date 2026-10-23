import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { enqueueLeadEffect } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { getDatabase, schema } from "@/shared/db";

/**
 * CALLEX (Vinicios, 23/10): leads whose number has no WhatsApp (Meta 131026, e.g. a
 * landline) are not left disqualified; they go to this queue and a broker calls them.
 * The queue is created once, for every unit; the director picks its brokers and
 * rules in the queue settings like any other queue.
 */
export const CALLEX_QUEUE_SLUG = "callex";
export const CALLEX_QUEUE_NAME = "CALLEX";

/** Shown to the broker (unlike the first-message failure note, which only the team sees). */
export const CALLEX_BROKER_NOTE = "📞 Lead sem WhatsApp: o número não recebe mensagens no WhatsApp. Atenda por ligação.";

export async function ensureCallexQueue(tenantId: string) {
  const db = getDatabase();
  const [existing] = await db.select({ id: schema.leadQueues.id })
    .from(schema.leadQueues)
    .where(and(eq(schema.leadQueues.tenantId, tenantId), eq(schema.leadQueues.slug, CALLEX_QUEUE_SLUG), isNull(schema.leadQueues.deletedAt)))
    .limit(1);
  if (existing) return existing.id;
  const id = randomUUID();
  await db.insert(schema.leadQueues).values({
    id,
    tenantId,
    branchId: null,
    name: CALLEX_QUEUE_NAME,
    slug: CALLEX_QUEUE_SLUG,
    // No WhatsApp: the virtual attendant has nothing to talk to.
    aiQualificationEnabled: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }).onConflictDoNothing();
  return id;
}

/** Moves a lead without WhatsApp to CALLEX and asks the distribution to hand it to a broker. */
export async function routeLeadToCallex(input: { tenantId: string; leadId: string; actorId: string }) {
  const db = getDatabase();
  const queueId = await ensureCallexQueue(input.tenantId);
  const now = new Date();
  const [lead] = await db.update(schema.leads)
    .set({ queueId, status: "new", distributionStatus: "queued", distributionUpdatedAt: now, updatedAt: now })
    .where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId), isNull(schema.leads.corretorId)))
    .returning({ id: schema.leads.id, branchId: schema.leads.branchId, nome: schema.leads.nome });
  if (!lead) return false;
  await db.insert(schema.leadDistributionEvents).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    toBranchId: lead.branchId,
    toQueueId: queueId,
    action: "no_whatsapp_routed_to_callex",
    source: "ai_qualification",
    strategy: "manual",
    reason: "Número sem WhatsApp: lead enviado para a fila CALLEX, para atendimento por ligação.",
    actorId: input.actorId,
    createdAt: now,
  });
  await db.insert(schema.leadInteractions).values({ id: randomUUID(), leadId: input.leadId, userId: input.actorId, tipo: "note", conteudo: CALLEX_BROKER_NOTE, createdAt: now }).onConflictDoNothing();
  await enqueueLeadEffect({
    tenantId: input.tenantId,
    leadId: input.leadId,
    type: "DISTRIBUTE_LEAD",
    idempotencyKey: `callex:${input.leadId}:${now.getTime()}`,
    payload: { branchId: lead.branchId, leadName: lead.nome },
  });
  return true;
}
