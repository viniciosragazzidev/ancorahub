import { describe, expect, it } from "vitest";
import { evaluateQualification, leadMatchesQualificationEntryRules } from "./service";
import type { AgentBehaviorPolicy } from "@/features/agent-training/service";

const policy = {
  assistantName: "Ana", tone: "friendly", formOfAddress: "voce", objective: "qualify_and_handoff",
  requiredFields: ["customerName", "city"], maxQuestions: 2, businessDays: "", handoffMessage: "Encaminho.", quickReplyTemplates: {}, knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
  qualification: { profileKey: "pf", fieldWeights: { customerName: 40, city: 60 }, entryRules: { origins: ["meta"], campaigns: [], leadTypes: ["PF"], branchIds: [], tags: [] } },
} satisfies AgentBehaviorPolicy;

describe("qualification engine", () => {
  it("calculates a weighted, incomplete qualification without changing commercial status", () => {
    const result = evaluateQualification({ customerName: { value: "Ana", confidence: 1 }, collectedFields: ["customerName"] }, policy);
    expect(result).toMatchObject({ state: "IN_PROGRESS", score: 40, qualificationStatus: "pending", missingFields: ["city"] });
  });
  it("keeps entry rules deterministic and opt-in", () => {
    expect(leadMatchesQualificationEntryRules({ origem: "meta", sourceCampaign: null, tipo: "PF", branchId: null }, policy)).toBe(true);
    expect(leadMatchesQualificationEntryRules({ origem: "manual", sourceCampaign: null, tipo: "PF", branchId: null }, policy)).toBe(false);
  });
});
