import "server-only";

import { and, eq } from "drizzle-orm";

import { enqueueLeadEffect } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { getDatabase, schema } from "@/shared/db";
import type { EffectHandlers } from "./runtime";

/**
 * Real effects of a flow run. The AI agent on the new engine only starts for
 * leads whose phone is a registered qualification test number, until the
 * switch-over (DEC-126); any other lead takes the agent's "failed" exit, which
 * the ready-made flows send to distribution.
 */
export function flowEffectHandlers(input: { tenantId: string; leadId: string; actorUserId: string; legacyIntake: () => Promise<void> }): EffectHandlers {
  return {
    legacyIntake: input.legacyIntake,
    async distribute({ tenantId, leadId, runId, nodeId }) {
      const [lead] = await getDatabase().select({ branchId: schema.leads.branchId, nome: schema.leads.nome }).from(schema.leads)
        .where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
      await enqueueLeadEffect({ tenantId, leadId, type: "DISTRIBUTE_LEAD", idempotencyKey: `attendance:${runId}:${nodeId}`, payload: { branchId: lead?.branchId ?? null, leadName: lead?.nome ?? null } });
    },
    async startAgent({ tenantId, leadId, engine }) {
      if (engine === "legacy") {
        const { startAiQualificationForLead } = await import("@/features/ai-qualification/service");
        const result = await startAiQualificationForLead({ tenantId, leadId, actorUserId: input.actorUserId });
        return { started: Boolean(result.started) };
      }
      if (!(await isQualificationTestLead(tenantId, leadId))) return { started: false };
      const { startQualificationConversationForLead } = await import("@/features/ai-agent/conversation-state-machine");
      const result = await startQualificationConversationForLead({ tenantId, leadId, actorUserId: input.actorUserId }, false, { flowTestLead: true });
      return { started: Boolean(result.started) };
    },
  };
}

/** Lead phone registered as a qualification test number (the only leads the new engine serves for now). */
export async function isQualificationTestLead(tenantId: string, leadId: string) {
  const db = getDatabase();
  const [lead] = await db.select({ phone: schema.leads.telefone }).from(schema.leads).where(and(eq(schema.leads.id, leadId), eq(schema.leads.tenantId, tenantId))).limit(1);
  const digits = lead?.phone?.replace(/\D/g, "") ?? "";
  if (!digits) return false;
  const numbers = await db.select({ phone: schema.aiQualificationTestNumbers.phoneNumber }).from(schema.aiQualificationTestNumbers)
    .where(eq(schema.aiQualificationTestNumbers.tenantId, tenantId));
  return numbers.some((row) => {
    const test = row.phone.replace(/\D/g, "");
    return test.length >= 8 && (digits.endsWith(test.slice(-11)) || test.endsWith(digits.slice(-11)));
  });
}
