import "server-only";

import { randomUUID } from "node:crypto";

import { and, eq, sql } from "drizzle-orm";

import { assignLeadToBroker } from "@/features/lead-distribution/service";
import { getDatabase, schema } from "@/shared/db";

import { CALL_ANCORA_SOURCE, COLD_MAX_ATTEMPTS } from "./cold-base";
import type { CallAncoraLastCall, CallOutcome } from "./session-store";

export const CALL_ANCORA_LEAD_TAKEN_MESSAGE = "Este lead já foi para outro corretor.";

const OUTCOME_TEXT: Record<CallOutcome, string> = {
  interested: "Com interesse",
  not_interested: "Sem interesse",
  no_answer: "Não atendeu",
  voicemail: "Caixa postal",
  wrong_number: "Número errado",
};

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export type ColdOutcomeResult = { assigned: boolean; conflict: string | null };

/**
 * Grava o resultado de uma ligação do Call Âncora para um frio (lead real).
 *
 * - "Com interesse": entrega o lead ao corretor pelo caminho de atribuição existente
 *   (`assignLeadToBroker`, o mesmo da transferência manual), que só vale se o lead ainda
 *   estiver sem corretor (UPDATE ... WHERE corretor_id IS NULL). Se outro corretor pegou
 *   antes, devolve o aviso e nada muda no lead.
 * - Todos os resultados: uma nota em `lead_interactions` (linha do tempo do lead) com
 *   `metadata.source = "call_ancora"`, o resultado, a duração, a regra automática e o chip.
 *   Essas notas tiram o lead do pool (Número errado, 4 h de intervalo, 3 tentativas).
 */
export async function recordColdOutcome(input: {
  tenantId: string;
  brokerId: string;
  leadId: string;
  outcome: CallOutcome;
  auto: boolean;
  correction?: boolean;
  lastCall: CallAncoraLastCall | null;
}): Promise<ColdOutcomeResult> {
  const db = getDatabase();
  const talkSeconds = input.lastCall?.talkSeconds ?? 0;
  let assigned = false;
  let conflict: string | null = null;

  if (input.outcome === "interested") {
    const [membership] = await db
      .select({ branchId: schema.tenantMemberships.branchId })
      .from(schema.tenantMemberships)
      .where(and(
        eq(schema.tenantMemberships.tenantId, input.tenantId),
        eq(schema.tenantMemberships.userId, input.brokerId),
        eq(schema.tenantMemberships.role, "broker"),
        eq(schema.tenantMemberships.status, "active"),
      ))
      .limit(1);
    if (!membership?.branchId) {
      conflict = "Só um corretor com unidade recebe o lead na carteira.";
    } else {
      // Contexto do sistema para o caminho de atribuição existente (exige gestor/diretor);
      // o ator registrado é o próprio corretor que fez a ligação.
      const result = await assignLeadToBroker(
        { userId: input.brokerId, tenantId: input.tenantId, role: "director", jobTitle: "director", branchId: null },
        input.leadId,
        input.brokerId,
        "call_ancora",
        `Call Âncora: interesse na ligação (${clock(talkSeconds)} em ligação)`,
        null,
        membership.branchId,
        { requireUnassigned: true, manualTransferOverride: true },
      );
      if (result.status === "assigned") {
        assigned = true;
      } else {
        const reason = "reason" in result ? String(result.reason ?? "") : "";
        conflict = /atribu|sem corretor|não encontrado/i.test(reason) ? CALL_ANCORA_LEAD_TAKEN_MESSAGE : reason || CALL_ANCORA_LEAD_TAKEN_MESSAGE;
      }
    }
  }

  const parts = [
    `Call Âncora: ${OUTCOME_TEXT[input.outcome]}${input.auto ? " (automático, estimativa)" : ""}${input.correction ? " (correção)" : ""}`,
    talkSeconds > 0 ? `${clock(talkSeconds)} em ligação` : null,
    input.lastCall?.causeLabel ?? null,
    assigned ? "lead enviado para a carteira do corretor" : null,
    conflict,
  ].filter(Boolean);

  await db.insert(schema.leadInteractions).values({
    id: randomUUID(),
    leadId: input.leadId,
    userId: input.brokerId,
    tipo: "note",
    conteudo: parts.join(" · "),
    metadata: {
      source: CALL_ANCORA_SOURCE,
      outcome: input.outcome,
      auto: input.auto,
      correction: Boolean(input.correction),
      talkSeconds,
      causeCode: input.lastCall?.causeCode ?? null,
      causeLabel: input.lastCall?.causeLabel ?? null,
      rule: input.lastCall?.rule ?? null,
      dialToActiveMs: input.lastCall?.dialToActiveMs ?? null,
      sim: input.lastCall?.sim ?? null,
      assigned,
    },
  });

  // Recuperação, fase 4: o resultado tira o lead da fila "Sem resposta" (interesse, nutrição ou não contatar).
  try {
    const { applyCallQueueOutcome } = await import("@/features/lead-recovery/call-queue");
    const [{ attempts }] = await db.select({ attempts: sql<number>`count(*)::int` }).from(schema.leadInteractions)
      .where(and(eq(schema.leadInteractions.leadId, input.leadId), sql`${schema.leadInteractions.metadata}->>'source' = ${CALL_ANCORA_SOURCE}`));
    await applyCallQueueOutcome({ tenantId: input.tenantId, leadId: input.leadId, outcome: input.outcome, assigned, attempts: Number(attempts) || 0, maxAttempts: COLD_MAX_ATTEMPTS });
  } catch (error) {
    console.warn("[call-ancora] recovery_outcome_failed", error instanceof Error ? error.message.slice(0, 160) : "unknown");
  }

  return { assigned, conflict };
}
