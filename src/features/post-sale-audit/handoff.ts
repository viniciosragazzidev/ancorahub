import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { getDatabase, schema } from "@/shared/db";
import { resolveSystemUserId } from "@/shared/tenant/system-user";
import { getSystemSetting } from "@/features/system-settings/queries";
import { buildDeclinedLeadReleaseUpdate } from "@/features/leads/decline-policy";
import {
  decidePostSaleHandoff,
  parsePostSaleHandoffSettings,
  POST_SALE_HANDOFF_AUDIT_ACTION,
  POST_SALE_HANDOFF_SOURCE,
  postSaleHandoffNote,
  postSaleHandoffSettingKey,
  type PostSaleHandoffSkip,
} from "./handoff-rules";
import type { PostSaleHandoffState } from "./turn-policy";

type Survey = typeof schema.postSaleSurveys.$inferSelect;

export async function loadPostSaleHandoffSettings(tenantId: string) {
  return parsePostSaleHandoffSettings(await getSystemSetting(postSaleHandoffSettingKey(tenantId)).catch(() => null));
}

/**
 * O lead desta pesquisa pode ir para outro corretor agora? Lido antes de responder ao cliente, para a IA
 * só prometer "outro corretor vai te chamar" quando a troca vai mesmo acontecer.
 */
export async function loadPostSaleHandoffEligibility(survey: Pick<Survey, "tenantId" | "leadId" | "brokerId">): Promise<{ allowed: boolean; skip?: PostSaleHandoffSkip }> {
  try {
    const settings = await loadPostSaleHandoffSettings(survey.tenantId);
    if (!settings.enabled) return { allowed: false, skip: "disabled" };
    const db = getDatabase();
    const [lead] = await db.select({
      corretorId: schema.leads.corretorId,
      status: schema.leads.status,
      deletedAt: schema.leads.deletedAt,
      archivedAt: schema.leads.archivedAt,
    }).from(schema.leads).where(and(eq(schema.leads.id, survey.leadId), eq(schema.leads.tenantId, survey.tenantId))).limit(1);
    const [owner] = lead?.corretorId
      ? await db.select({ role: schema.tenantMemberships.role }).from(schema.tenantMemberships)
        .where(and(eq(schema.tenantMemberships.tenantId, survey.tenantId), eq(schema.tenantMemberships.userId, lead.corretorId))).limit(1)
      : [];
    const { isLeadInActiveAutoSale } = await import("@/features/auto-sale/repository");
    const inAutoSale = lead ? await isLeadInActiveAutoSale(survey.tenantId, survey.leadId).catch(() => true) : false;
    const decision = decidePostSaleHandoff({ settings, surveyBrokerId: survey.brokerId, lead: lead ?? null, ownerRole: owner?.role ?? null, inAutoSale });
    return decision.allowed ? { allowed: true } : { allowed: false, skip: decision.skip };
  } catch (error) {
    console.warn("[post-sale-audit] handoff_eligibility_failed", { leadId: survey.leadId, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
    return { allowed: false };
  }
}

function readHandoff(answers: unknown): PostSaleHandoffState | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const value = (answers as Record<string, unknown>).handoff;
  return value && typeof value === "object" && !Array.isArray(value) ? value as PostSaleHandoffState : null;
}

/**
 * Executa a troca pedida pela conversa (answers.handoff pendente). Idempotente: o lead só é solto se ainda
 * está com o corretor da pesquisa; numa retentativa, a troca já feita não se repete. Depois, a distribuição
 * normal oferece o lead pela fila, respeitando plantão e filas, sem o corretor antigo.
 */
export async function runPendingPostSaleHandoff(survey: Survey) {
  const handoff = readHandoff(survey.answers);
  if (!handoff || handoff.status !== "pending" || !survey.brokerId) return;
  const db = getDatabase();
  const now = new Date();
  const finish = async (status: PostSaleHandoffState["status"], result: string, newBrokerId: string | null = null) => {
    const next: PostSaleHandoffState = { ...handoff, status, result, doneAt: now.toISOString(), newBrokerId };
    await db.update(schema.postSaleSurveys)
      .set({ answers: sql`jsonb_set(coalesce(${schema.postSaleSurveys.answers}, '{}'::jsonb), '{handoff}', ${JSON.stringify(next)}::jsonb)` })
      .where(and(eq(schema.postSaleSurveys.id, survey.id), eq(schema.postSaleSurveys.tenantId, survey.tenantId)));
  };
  // A troca só acontece com o interruptor ligado também na hora de executar.
  const eligibility = await loadPostSaleHandoffEligibility(survey);
  if (!eligibility.allowed) {
    await finish("skipped", eligibility.skip ?? "unknown");
    return;
  }
  const [lead] = await db.select({ nome: schema.leads.nome, branchId: schema.leads.branchId, queueId: schema.leads.queueId })
    .from(schema.leads).where(and(eq(schema.leads.id, survey.leadId), eq(schema.leads.tenantId, survey.tenantId))).limit(1);
  if (!lead) {
    await finish("skipped", "lead_closed");
    return;
  }
  const actorId = await resolveSystemUserId(survey.tenantId);
  const previousBrokerId = survey.brokerId;
  const note = postSaleHandoffNote({ leadName: lead.nome ?? "Cliente", contactStatus: handoff.contactStatus });
  const released = await db.transaction(async (tx) => {
    const [row] = await tx.update(schema.leads)
      .set({ ...buildDeclinedLeadReleaseUpdate(now), redistributionCount: sql`${schema.leads.redistributionCount} + 1` })
      .where(and(
        eq(schema.leads.id, survey.leadId),
        eq(schema.leads.tenantId, survey.tenantId),
        eq(schema.leads.corretorId, previousBrokerId),
        isNull(schema.leads.deletedAt),
      ))
      .returning({ id: schema.leads.id });
    if (!row) return false;
    await tx.update(schema.leadAssignmentAttempts)
      .set({ status: "released", releasedAt: now, releaseReason: handoff.reason.slice(0, 200) })
      .where(and(
        eq(schema.leadAssignmentAttempts.tenantId, survey.tenantId),
        eq(schema.leadAssignmentAttempts.leadId, survey.leadId),
        eq(schema.leadAssignmentAttempts.brokerId, previousBrokerId),
        eq(schema.leadAssignmentAttempts.status, "open"),
      ));
    // O evento guarda o corretor antigo: a distribuição o deixa de fora das ofertas deste lead.
    await tx.insert(schema.leadDistributionEvents).values({
      id: randomUUID(),
      tenantId: survey.tenantId,
      leadId: survey.leadId,
      fromBranchId: lead.branchId,
      toBranchId: lead.branchId,
      fromQueueId: lead.queueId,
      toQueueId: lead.queueId,
      previousOwnerId: previousBrokerId,
      newOwnerId: null,
      action: "returned_to_queue",
      source: POST_SALE_HANDOFF_SOURCE,
      strategy: "automatic",
      reason: handoff.reason.slice(0, 300),
      actorId,
      metadata: { surveyId: survey.id, ruleKey: survey.ruleKey, contactStatus: handoff.contactStatus, excludedBrokerId: previousBrokerId },
      createdAt: now,
    });
    await tx.insert(schema.auditLogs).values({
      id: randomUUID(),
      userId: actorId,
      entidade: "lead",
      entidadeId: survey.leadId,
      acao: POST_SALE_HANDOFF_AUDIT_ACTION,
      metadata: { source: "post_sale_audit", surveyId: survey.id, ruleKey: survey.ruleKey, previousBrokerId, contactStatus: handoff.contactStatus, reason: handoff.reason },
      createdAt: now,
    });
    await tx.insert(schema.leadInteractions).values({
      id: `post-sale-handoff-${survey.id}`,
      leadId: survey.leadId,
      userId: actorId,
      tipo: "system_alert",
      conteudo: note.timeline,
      metadata: { source: "post_sale_audit", surveyId: survey.id, previousBrokerId },
      createdAt: now,
    }).onConflictDoNothing();
    // O corretor antigo fica sabendo; a gestão recebe o alerta do pós-venda (ensurePostSaleSurveyAlerts).
    await tx.insert(schema.notifications).values({
      id: randomUUID(),
      tenantId: survey.tenantId,
      recipientUserId: previousBrokerId,
      leadId: survey.leadId,
      type: "post_sale_alert",
      title: note.brokerTitle,
      message: note.brokerMessage,
      idempotencyKey: `post-sale-handoff:${survey.id}:${previousBrokerId}`,
      createdAt: now,
    }).onConflictDoNothing();
    return true;
  });
  if (!released) {
    await finish("skipped", "owner_changed");
    return;
  }
  // Distribuição normal da fila (plantão, filas, ordem). O corretor antigo fica de fora pelo evento acima.
  let result = "queued";
  let newBrokerId: string | null = null;
  try {
    const { enqueueAndProcessLeadDistribution } = await import("@/features/lead-distribution/jobs");
    await enqueueAndProcessLeadDistribution({ tenantId: survey.tenantId, leadId: survey.leadId, source: "post_sale_handoff" });
    const [after] = await db.select({ corretorId: schema.leads.corretorId }).from(schema.leads)
      .where(and(eq(schema.leads.id, survey.leadId), eq(schema.leads.tenantId, survey.tenantId))).limit(1);
    newBrokerId = after?.corretorId ?? null;
    result = newBrokerId ? "offered" : "queued";
  } catch (error) {
    console.error("[post-sale-audit] handoff_distribution_failed", { leadId: survey.leadId, error: error instanceof Error ? error.message.slice(0, 120) : "unknown" });
  }
  await finish("done", result, newBrokerId);
}
