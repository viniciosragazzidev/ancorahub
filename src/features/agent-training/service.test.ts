import { describe, expect, it } from "vitest";
import { runCriticalSimulations, type AgentBehaviorPolicy, validateAgentBehaviorPolicy } from "./service";

const policy: AgentBehaviorPolicy = { assistantName: "Agente", tone: "friendly", formOfAddress: "voce", objective: "qualify_and_handoff", requiredFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"], maxQuestions: 6, businessDays: "", handoffMessage: "Vou encaminhar você.", quickReplyTemplates: {}, knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true }, qualification: { profileKey: "general", fieldWeights: {}, entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] } } };

describe("agent training policy", () => {
  it("blocks policies whose mandatory fields exceed the question limit", () => {
    expect(validateAgentBehaviorPolicy({ ...policy, maxQuestions: 5 }).valid).toBe(false);
  });
  it("covers the mandatory safety simulations", () => {
    expect(runCriticalSimulations(policy).every((result) => result.passed)).toBe(true);
  });
});
