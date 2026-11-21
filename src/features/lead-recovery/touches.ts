import "server-only";

import { randomUUID } from "node:crypto";

import { getDatabase, schema } from "@/shared/db";

import { touchCostBrl } from "./touch-cost";

export type RecoveryTouchInput = {
  tenantId: string;
  leadId: string;
  segment: "never_replied" | "stopped_midway" | "warm" | "call_queue" | "nurture";
  step: string;
  attempt?: number;
  channel: "meta" | "waha" | "call" | null;
  template?: string | null;
  status: "sent" | "skipped" | "failed" | "held";
  reason?: string | null;
  errorCode?: string | null;
  outboundId?: string | null;
  messageId?: string | null;
  controlGroup?: boolean;
  /** Template de marketing, utility ou texto livre (para o custo estimado). */
  kind?: "marketing" | "utility" | "free";
};

let tableMissingUntil = 0;

/**
 * Grava um toque de recuperação (migration 0234). Nunca derruba o envio: sem a tabela (migration ainda não
 * aplicada) ou com erro, só registra no log e para de tentar por 10 minutos.
 */
export async function recordRecoveryTouch(input: RecoveryTouchInput) {
  if (Date.now() < tableMissingUntil) return;
  try {
    await getDatabase().insert(schema.leadRecoveryTouches).values({
      id: randomUUID(),
      tenantId: input.tenantId,
      leadId: input.leadId,
      segment: input.segment,
      step: input.step,
      attempt: input.attempt ?? 1,
      channel: input.channel,
      template: input.template ?? null,
      status: input.status,
      reason: input.reason ?? null,
      errorCode: input.errorCode ?? null,
      outboundId: input.outboundId ?? null,
      messageId: input.messageId ?? null,
      costBrl: String(input.status === "sent" ? touchCostBrl(input.kind ?? "free", input.channel) : 0),
      controlGroup: input.controlGroup ?? false,
    }).onConflictDoNothing();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/lead_recovery_touches/.test(message) && /does not exist|não existe/.test(message)) tableMissingUntil = Date.now() + 10 * 60_000;
    console.warn("[lead-recovery] touch_not_recorded", { leadId: input.leadId, step: input.step, error: message.slice(0, 160) });
  }
}
