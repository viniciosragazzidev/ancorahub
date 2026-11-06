import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { getDatabase } from "@/shared/db";
import { schema } from "@/shared/db";

import { stageActorType, type StageActorType } from "./stage-history-core";

type Executor = Pick<ReturnType<typeof getDatabase>, "insert">;
type LeadStatus = (typeof schema.leadStatusValues)[number];

export { stageActorType, type StageActorType };

/**
 * Grava a mudança de etapa no histórico e o marco no funil (05/11). Roda dentro da mesma transação da
 * mudança de etapa: se ela falhar, nada fica registrado pela metade.
 */
export async function recordStageChange(tx: Executor, input: {
  tenantId: string;
  leadId: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: Date;
  actorType: StageActorType;
  actorUserId: string | null;
  reason: string | null;
  lossCode: string | null;
  previousStageEnteredAt: Date | null;
  lead: { branchId: string | null; queueId: string | null; sourceChannel: string | null; metaCampaignId: string | null; metaAdId: string | null; metaFormId: string | null };
}) {
  const secondsInPrevious = input.previousStageEnteredAt
    ? Math.max(0, Math.round((input.changedAt.getTime() - input.previousStageEnteredAt.getTime()) / 1000))
    : null;
  const origin = {
    branchId: input.lead.branchId,
    queueId: input.lead.queueId,
    sourceChannel: input.lead.sourceChannel,
    metaCampaignId: input.lead.metaCampaignId,
    metaAdId: input.lead.metaAdId,
    metaFormId: input.lead.metaFormId,
  };
  await tx.insert(schema.leadStageHistory).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    fromStatus: (input.fromStatus as LeadStatus | null) ?? null,
    toStatus: input.toStatus as LeadStatus,
    changedAt: input.changedAt,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    reason: input.reason,
    lossCode: input.lossCode,
    secondsInPrevious,
    ...origin,
  });
  // Marco do funil: a primeira vez em cada etapa conta uma vez só (voltar e entrar de novo não duplica).
  await tx.insert(schema.leadFunnelEvents).values({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    event: "stage_entered",
    stepKey: input.toStatus,
    occurredAt: input.changedAt,
    dedupeKey: `stage:${input.leadId}:${input.toStatus}`,
    metadata: { from: input.fromStatus, actorType: input.actorType, ...(input.lossCode ? { lossCode: input.lossCode } : {}) },
    ...origin,
  }).onConflictDoNothing();
}

/** Atalho para quem muda a etapa por fora de `changeLeadStatus` (venda, início do atendimento): busca a origem do lead. */
export async function recordStageChangeForLead(tx: Executor & Pick<ReturnType<typeof getDatabase>, "select">, input: {
  tenantId: string;
  leadId: string;
  fromStatus: string | null;
  toStatus: string;
  changedAt: Date;
  actorType: StageActorType;
  actorUserId: string | null;
  reason: string | null;
  previousStageEnteredAt?: Date | null;
}) {
  const [lead] = await tx.select({
    branchId: schema.leads.branchId,
    queueId: schema.leads.queueId,
    sourceChannel: schema.leads.sourceChannel,
    metaCampaignId: schema.leads.metaCampaignId,
    metaAdId: schema.leads.metaAdId,
    metaFormId: schema.leads.metaFormId,
  }).from(schema.leads).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId))).limit(1);
  if (!lead) return;
  await recordStageChange(tx, { ...input, lossCode: null, previousStageEnteredAt: input.previousStageEnteredAt ?? null, lead });
}
