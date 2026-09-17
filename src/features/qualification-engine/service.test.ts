import { describe, expect, it } from "vitest";
import { buildPrivateQualificationContext, evaluateQualification, leadMatchesQualificationEntryRules } from "./service";
import { createEmptyMemory } from "@/features/ai-agent/memory";
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
  it("treats the PME average age as the required age field", () => {
    const pmePolicy: AgentBehaviorPolicy = { ...policy, requiredFields: ["planType", "numberOfLives", "age"] };
    const result = evaluateQualification({
      planType: { value: "empresarial", confidence: 1 },
      numberOfLives: { value: "18", confidence: 1 },
      averageAge: { value: "36", confidence: 1 },
      collectedFields: ["planType", "numberOfLives", "age"],
    }, pmePolicy);
    expect(result).toMatchObject({ state: "QUALIFIED", missingFields: [] });
  });

  it("builds a private, structured context from facts captured in a long answer", () => {
    const context = buildPrivateQualificationContext({
      ...createEmptyMemory(),
      planType: { value: "empresarial", confidence: 1 },
      numberOfLives: { value: "2", confidence: 1 },
      averageAge: { value: "62", confidence: 1 },
      city: { value: "Recreio dos Bandeirantes", confidence: 1 },
      intent: { value: "opções mais baratas", confidence: 1 },
      collectedFields: ["planType", "numberOfLives", "age", "city", "intent"],
    });

    expect(context.source).toBe("ai_qualification");
    expect(context.summary).toContain("Recreio dos Bandeirantes");
    expect(context.facts).toEqual(expect.arrayContaining([
      "tipo de plano: empresarial",
      "vidas: 2",
      "média de idade: 62",
      "cidade: Recreio dos Bandeirantes",
      "interesse: opções mais baratas",
    ]));
    expect(context.memory.planType?.value).toBe("empresarial");
  });
});
