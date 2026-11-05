import "server-only";

import { randomUUID } from "node:crypto";

import type { getDatabase } from "@/shared/db";
import { schema } from "@/shared/db";

type Executor = Pick<ReturnType<typeof getDatabase>, "insert">;

export type FunnelOrigin = {
  branchId: string | null;
  queueId: string | null;
  sourceChannel: string | null;
  metaCampaignId: string | null;
  metaAdId: string | null;
  metaFormId: string | null;
};

export type FunnelEventInput = {
  event: "question_answered" | "qualification_result";
  stepKey: string;
  /** Mesmo marco duas vezes não conta de novo (ex.: a mesma pergunta respondida em turnos seguidos). */
  dedupeKey: string;
  metadata?: Record<string, unknown>;
};

/**
 * Marcos do funil que não existem em outra tabela (05/11): cada pergunta da qualificação respondida e o resultado
 * da qualificação. Chegada (leads.created_at), mensagens, corretor e etapas já têm registro próprio.
 */
export async function recordFunnelEvents(tx: Executor, input: { tenantId: string; leadId: string; occurredAt: Date; origin: FunnelOrigin; events: FunnelEventInput[] }) {
  if (!input.events.length) return;
  await tx.insert(schema.leadFunnelEvents).values(input.events.map((event) => ({
    id: randomUUID(),
    tenantId: input.tenantId,
    leadId: input.leadId,
    event: event.event,
    stepKey: event.stepKey,
    occurredAt: input.occurredAt,
    dedupeKey: event.dedupeKey,
    metadata: event.metadata ?? {},
    ...input.origin,
  }))).onConflictDoNothing();
}

/** Eventos de uma avaliação da qualificação: uma "resposta" por campo coletado e o resultado, se final. */
export function qualificationFunnelEvents(leadId: string, result: { state: string; classification?: string | null; completedFields: readonly string[] }): FunnelEventInput[] {
  const answered: FunnelEventInput[] = result.completedFields.map((field) => ({ event: "question_answered", stepKey: field, dedupeKey: `q:${leadId}:${field}` }));
  const final = ["QUALIFIED", "PARTIAL", "NOT_INTERESTED", "DISQUALIFIED"].includes(result.state);
  return final
    ? [...answered, { event: "qualification_result", stepKey: result.state, dedupeKey: `qr:${leadId}:${result.state}`, metadata: { classification: result.classification ?? null } }]
    : answered;
}
