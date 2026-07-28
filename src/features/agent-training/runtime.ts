import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase, schema } from "@/shared/db";
import { agentBehaviorPolicySchema, type AgentBehaviorPolicy } from "./service";

export async function resolvePublishedAgentBehavior(tenantId: string, pinnedVersionId?: string | null): Promise<{ policy: AgentBehaviorPolicy; versionId: string | null }> {
  const db = getDatabase();
  const [version] = await db.select({ id: schema.agentBehaviorVersions.id, policy: schema.agentBehaviorVersions.policy })
    .from(schema.agentBehaviorVersions)
    .where(and(eq(schema.agentBehaviorVersions.tenantId, tenantId), pinnedVersionId ? eq(schema.agentBehaviorVersions.id, pinnedVersionId) : eq(schema.agentBehaviorVersions.status, "PUBLISHED")))
    .orderBy(desc(schema.agentBehaviorVersions.versionNumber)).limit(1);
  const parsed = agentBehaviorPolicySchema.safeParse(version?.policy);
  if (parsed.success) return { policy: parsed.data, versionId: version?.id ?? null };
  return {
    versionId: null,
    policy: {
      assistantName: "Assistente AncoraHub", tone: "friendly", formOfAddress: "voce", objective: "qualify_and_handoff",
      requiredFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"], maxQuestions: 6,
      businessDays: "", handoffMessage: "Vou encaminhar você para um corretor da equipe agora.", quickReplyTemplates: {},
      knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
      qualification: { profileKey: "general", fieldWeights: {}, entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] } },
    },
  };
}
