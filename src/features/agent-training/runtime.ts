import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { agentBehaviorPolicySchema, type AgentBehaviorPolicy } from "./service";

export async function resolvePublishedAgentBehavior(tenantId: string, pinnedVersionId?: string | null): Promise<{ policy: AgentBehaviorPolicy; versionId: string | null }> {
  const db = getDatabase();
  const [versions, tenantConfigRows] = await Promise.all([
    db.select({ id: schema.agentBehaviorVersions.id, policy: schema.agentBehaviorVersions.policy })
      .from(schema.agentBehaviorVersions)
      .where(and(eq(schema.agentBehaviorVersions.tenantId, tenantId), pinnedVersionId ? eq(schema.agentBehaviorVersions.id, pinnedVersionId) : eq(schema.agentBehaviorVersions.status, "PUBLISHED")))
      .orderBy(desc(schema.agentBehaviorVersions.versionNumber)).limit(1),
    db.select().from(schema.aiQualificationConfigs).where(eq(schema.aiQualificationConfigs.tenantId, tenantId)).limit(1).catch(() => []),
  ]);

  const version = versions[0];
  const configRow = tenantConfigRows[0];
  const parsed = agentBehaviorPolicySchema.safeParse(version?.policy);
  let policy: AgentBehaviorPolicy;

  if (parsed.success) {
    policy = parsed.data;
  } else {
    policy = {
      assistantName: configRow?.assistantName || "Assistente AncoraHub",
      tone: (configRow?.tone as any) || "friendly",
      formOfAddress: (configRow?.formOfAddress as any) || "voce",
      objective: "qualify_and_handoff",
      requiredFields: (configRow?.requiredFields as any) || ["customerName", "planType", "numberOfLives", "age", "city", "email"],
      maxQuestions: configRow?.maxQuestions ?? 6,
      businessDays: configRow?.businessDays ?? "",
      handoffMessage: configRow?.handoffMessage || "Vou encaminhar você para um corretor da equipe agora.",
      quickReplyTemplates: {},
      knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
      qualification: { profileKey: "general", fieldWeights: {}, entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] } },
    };
  }

  if (configRow) {
    if (configRow.requiredFields && Array.isArray(configRow.requiredFields) && configRow.requiredFields.length > 0) {
      policy.requiredFields = configRow.requiredFields as any;
    }
    if (configRow.maxQuestions) {
      policy.maxQuestions = configRow.maxQuestions;
    }
    if (configRow.handoffMessage) {
      policy.handoffMessage = configRow.handoffMessage;
    }
    if (configRow.assistantName) {
      policy.assistantName = configRow.assistantName;
    }
  }

  return { policy, versionId: version?.id ?? null };
}
