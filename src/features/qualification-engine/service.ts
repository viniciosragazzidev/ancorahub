import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";

import type { AgentBehaviorPolicy } from "@/features/agent-training/service";
import type { ConversationMemory } from "@/features/ai-agent/memory";
import { deriveLeadQualificationStatus } from "@/features/leads/qualification-status";
import { getDatabase, schema } from "@/shared/db";

export const qualificationStates = ["NOT_STARTED", "IN_PROGRESS", "QUALIFIED", "PARTIAL", "INCONCLUSIVE", "NOT_INTERESTED"] as const;
export type QualificationState = (typeof qualificationStates)[number];

type LeadEligibilityInput = {
  origem: string;
  sourceCampaign: string | null;
  tipo: string;
  branchId: string | null;
  tags?: string[];
};

export type QualificationEvaluation = {
  state: QualificationState;
  score: number;
  completedFields: string[];
  missingFields: string[];
  qualificationStatus: "pending" | "qualified" | "hot" | "warm" | "cold";
};

const memoryFieldByPolicyField: Record<string, keyof ConversationMemory> = {
  customerName: "customerName",
  planType: "planType",
  numberOfLives: "numberOfLives",
  age: "age",
  city: "city",
  email: "email",
};

export function leadMatchesQualificationEntryRules(lead: LeadEligibilityInput, policy: AgentBehaviorPolicy) {
  const rules = policy.qualification.entryRules;
  const matches = (values: string[], value: string | null | undefined) => values.length === 0 || Boolean(value && values.includes(value));
  return matches(rules.origins, lead.origem)
    && matches(rules.campaigns, lead.sourceCampaign)
    && matches(rules.leadTypes, lead.tipo)
    && matches(rules.branchIds, lead.branchId)
    && (rules.tags.length === 0 || (lead.tags ?? []).some((tag) => rules.tags.includes(tag)));
}

export function evaluateQualification(memory: ConversationMemory, policy: AgentBehaviorPolicy, reason?: "human_requested" | "not_interested") : QualificationEvaluation {
  const required = policy.requiredFields;
  const completedFields = required.filter((field) => Boolean((memory[memoryFieldByPolicyField[field]] as { value?: string } | undefined)?.value));
  const missingFields = required.filter((field) => !completedFields.includes(field));
  const weightedTotal = required.reduce((total, field) => total + (policy.qualification.fieldWeights[field] ?? 1), 0);
  const weightedCompleted = completedFields.reduce((total, field) => total + (policy.qualification.fieldWeights[field] ?? 1), 0);
  const score = weightedTotal ? Math.round((weightedCompleted / weightedTotal) * 100) : 0;
  const state: QualificationState = reason === "not_interested"
    ? "NOT_INTERESTED"
    : completedFields.length === required.length
      ? "QUALIFIED"
      : reason === "human_requested"
        ? "PARTIAL"
        : completedFields.length > 0 ? "IN_PROGRESS" : "NOT_STARTED";
  return {
    state,
    score,
    completedFields,
    missingFields,
    qualificationStatus: state === "NOT_INTERESTED" ? "cold" : state === "QUALIFIED" ? deriveLeadQualificationStatus(memory) : "pending",
  };
}

export async function persistQualificationEvaluation(input: {
  tenantId: string;
  leadId: string;
  conversationId: string;
  actorUserId: string | null;
  policy: AgentBehaviorPolicy;
  memory: ConversationMemory;
  reason?: "human_requested" | "not_interested";
}) {
  const result = evaluateQualification(input.memory, input.policy, input.reason);
  const db = getDatabase();
  const now = new Date();
  const [auditActor] = input.actorUserId ? [{ userId: input.actorUserId }] : await db.select({ userId: schema.tenantMemberships.userId })
    .from(schema.tenantMemberships)
    .where(and(eq(schema.tenantMemberships.tenantId, input.tenantId), eq(schema.tenantMemberships.role, "director"), eq(schema.tenantMemberships.status, "active")))
    .limit(1);
  await db.transaction(async (tx) => {
    await tx.update(schema.leads).set({
      qualificationState: result.state,
      qualificationScore: result.score,
      qualificationStatus: result.qualificationStatus,
      qualificationProfileKey: input.policy.qualification.profileKey,
      qualificationCompletedAt: result.state === "QUALIFIED" ? now : null,
      qualificationDetails: { completedFields: result.completedFields, missingFields: result.missingFields, profileKey: input.policy.qualification.profileKey },
      updatedAt: now,
    }).where(and(eq(schema.leads.id, input.leadId), eq(schema.leads.tenantId, input.tenantId)));
    if (auditActor?.userId) await tx.insert(schema.auditLogs).values({
      id: randomUUID(), userId: auditActor.userId, entidade: "lead_qualification", entidadeId: input.leadId,
      acao: `qualification.${result.state.toLowerCase()}`,
    });
  });
  return result;
}
