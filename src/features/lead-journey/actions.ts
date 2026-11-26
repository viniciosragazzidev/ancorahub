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

/**
 * "Momento ruim" (R5, fase 5): o cliente disse "agora não". O lead sai das cadências e volta pela nutrição na data
 * combinada (padrão: 30 dias). Só marca: não manda nada agora.
 */
export async function markBadMomentAction(input: { leadId: string; days?: number }): Promise<JourneyActionResult<{ until: string }>> {
  try {
    const context = await requireQualificationAccess();
    const { leadId } = leadInput.parse(input);
    const days = Math.min(180, Math.max(7, Math.round(input.days ?? 30)));
    const now = new Date();
    const until = new Date(now.getTime() + days * 86_400_000).toISOString();
    const updated = await getDatabase().update(schema.leads)
      .set({ qualificationDetails: sql`jsonb_set(coalesce(${schema.leads.qualificationDetails}, '{}'::jsonb), '{recovery}', ${JSON.stringify({ state: "bad_moment", at: now.toISOString(), until, touches: 0, by: context.userId })}::jsonb)` })
      .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, context.tenantId)))
      .returning({ id: schema.leads.id });
    if (!updated.length) return { ok: false, error: "Lead não encontrado." };
    await getDatabase().insert(schema.auditLogs).values({ id: randomUUID(), userId: context.userId, entidade: "lead", entidadeId: leadId, acao: `recovery.bad_moment:${days}`, createdAt: now }).catch(() => undefined);
    revalidatePath("/qualificacao/leads");
    return { ok: true, data: { until } };
  } catch (error) {
    console.error("[lead-journey] bad_moment", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui marcar agora. O lead continua como estava." };
  }
}

type RecoveryAction = "pause" | "resume" | "skip" | "finish";
type RecoveryPositionView = import("@/features/lead-recovery/position").RecoveryPositionDetail;

/** "Onde está agora" (gaveta de /qualificacao/leads): passo atual, próximo toque e o que dá para fazer. */
export async function getRecoveryPositionAction(input: { leadId: string }): Promise<JourneyActionResult<{ position: RecoveryPositionView | null }>> {
  try {
    const context = await requireQualificationAccess();
    const { leadId } = leadInput.parse(input);
    const { getRecoveryPosition, leadInRecoveryScope } = await import("@/features/lead-recovery/position");
    if (!(await leadInRecoveryScope(context, leadId))) return { ok: false, error: "Este lead não está no seu escopo." };
    return { ok: true, data: { position: await getRecoveryPosition(context.tenantId, leadId) } };
  } catch (error) {
    console.error("[lead-journey] recovery_position", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui ver a recuperação agora." };
  }
}

/**
 * Pausar, retomar, pular passo e encerrar a recuperação de um lead. Respeita o escopo (diretor: empresa; gestor:
 * unidade; supervisor: equipe ou sem corretor), grava a auditoria e devolve a posição nova. Nada aqui manda mensagem.
 */
export async function changeRecoveryAction(input: { leadId: string; action: RecoveryAction }): Promise<JourneyActionResult<{ position: RecoveryPositionView | null; skipped?: string }>> {
  try {
    const context = await requireQualificationAccess();
    const { leadId } = leadInput.parse(input);
    const action = z.enum(["pause", "resume", "skip", "finish"]).parse(input.action);
    const recovery = await import("@/features/lead-recovery/position");
    if (!(await recovery.leadInRecoveryScope(context, leadId))) return { ok: false, error: "Este lead não está no seu escopo." };
    const now = new Date();
    let skipped: string | undefined;
    try {
      if (action === "pause") await recovery.pauseRecovery(context.tenantId, leadId, context.userId, now);
      if (action === "resume") await recovery.resumeRecovery(context.tenantId, leadId, context.userId, now);
      if (action === "skip") skipped = await recovery.skipRecoveryStep(context.tenantId, leadId, context.userId, now);
      if (action === "finish") await recovery.finishRecovery(context.tenantId, leadId, context.userId, now);
    } catch (error) {
      if (error instanceof recovery.RecoveryActionError) return { ok: false, error: error.message };
      throw error;
    }
    revalidatePath("/qualificacao/leads");
    return { ok: true, data: { position: await recovery.getRecoveryPosition(context.tenantId, leadId), skipped } };
  } catch (error) {
    console.error("[lead-journey] recovery_change", error instanceof Error ? error.message : error);
    return { ok: false, error: "Não consegui mudar a recuperação agora. O lead continua como estava." };
  }
}
