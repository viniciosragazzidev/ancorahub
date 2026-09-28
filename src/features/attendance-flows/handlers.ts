import "server-only";

import { and, eq } from "drizzle-orm";

import { enqueueLeadEffect } from "@/features/leads/webhooks/services/lead-effect-outbox";
import { getDatabase, schema } from "@/shared/db";
import type { EffectHandlers } from "./runtime";

/**
 * Real effects of a flow run. Choosing a flow with the new engine for a queue
 * is what turns the new engine on for that queue's leads (DEC-126); a lead the
 * agent cannot start takes the agent's "failed" exit, which the ready-made
 * flows send to distribution.
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
      const { startQualificationConversationForLead } = await import("@/features/ai-agent/conversation-state-machine");
      const result = await startQualificationConversationForLead({ tenantId, leadId, actorUserId: input.actorUserId }, false, { fromFlow: true });
      return { started: Boolean(result.started) };
    },
  };
}
