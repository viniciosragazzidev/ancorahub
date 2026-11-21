"use server";

import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hasCapability } from "@/shared/auth/permissions";
import { getRequiredTenantContext } from "@/shared/auth/tenant-context";
import { getDatabase, schema } from "@/shared/db";

import { getQualificationTimeline } from "./queries";
import type { QualificationLeadRow } from "./rows";
import type { TimelineItem } from "./timeline";

export type JourneyActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function requireQualificationAccess() {
  const context = await getRequiredTenantContext();
  if (!hasCapability(context.role, "acessar_qualificacao_ia", context.jobTitle)) throw new Error("Sem permissão para a qualificação por IA.");
  return context;
}

const leadInput = z.object({ leadId: z.string().min(1).max(80) });

/** Linha do tempo da qualificação (drawer de /qualificacao/leads). */
export async function getLeadTimelineAction(input: { leadId: string }): Promise<JourneyActionResult<{ row: QualificationLeadRow | null; items: TimelineItem[] }>> {
  try {
    const context = await requireQualificationAccess();
    const { leadId } = leadInput.parse(input);
    return { ok: true, data: await getQualificationTimeline(context.tenantId, leadId) };
  } catch (error) {
    console.error("[lead-journey] timeline", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui carregar a linha do tempo agora." };
  }
}

/**
 * "Não contatar" (X1): a conversa de IA ganha opt-out (a IA, o turbo e o follow-up de silêncio já respeitam) e o
 * lead ganha a marca em `qualification_details.recovery`, que a cadência de recuperação respeita. Não manda nada.
 */
export async function markDoNotContactAction(input: { leadId: string }): Promise<JourneyActionResult<{ leadId: string }>> {
  try {
    const context = await requireQualificationAccess();
    const { leadId } = leadInput.parse(input);
    const db = getDatabase();
    const now = new Date();
    const updated = await db.update(schema.leads)
      .set({ qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', ${JSON.stringify({ state: "do_not_contact", at: now.toISOString(), by: context.userId })}::jsonb)` })
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .returning({ id: schema.leads.id });
    if (!updated.length) return { ok: false, error: "Lead não encontrado." };
    const [conversation] = await db.select({ id: schema.aiConversations.id }).from(schema.aiConversations)
      .where(and(eq(schema.aiConversations.tenantId, context.tenantId), eq(schema.aiConversations.leadId, leadId)))
      .orderBy(desc(schema.aiConversations.updatedAt)).limit(1);
    if (conversation) {
      await db.update(schema.aiConversations).set({ optOutAt: now })
        .where(and(eq(schema.aiConversations.id, conversation.id), eq(schema.aiConversations.tenantId, context.tenantId)));
    }
    await db.insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId, acao: "recovery.do_not_contact", createdAt: now }).catch(() => undefined);
    revalidatePath("/qualificacao/leads");
    return { ok: true, data: { leadId } };
  } catch (error) {
    console.error("[lead-journey] do_not_contact", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui marcar agora. O lead continua como estava." };
  }
}

/** "Mandar para a fila de ligação" (R4, fase 4): só marca o lead e calcula a pontuação. Não liga nem manda nada. */
export async function sendToCallQueueAction(input: { leadId: string }): Promise<JourneyActionResult<{ score: string }>> {
  try {
    const context = await requireQualificationAccess();
    const { leadId } = leadInput.parse(input);
    const { enterCallQueue } = await import("@/features/lead-recovery/call-queue");
    const score = await enterCallQueue(context.tenantId, leadId, "manual", new Date(), context.userId);
    revalidatePath("/qualificacao/leads");
    return { ok: true, data: { score: score.label } };
  } catch (error) {
    console.error("[lead-journey] call_queue", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui mandar para a fila agora. O lead continua como estava." };
  }
}
