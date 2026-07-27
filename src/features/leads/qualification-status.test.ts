import { describe, expect, it } from "vitest";

import { createEmptyMemory } from "@/features/ai-agent/memory";
import { deriveLeadQualificationStatus } from "./qualification-status";

describe("lead qualification status", () => {
  it("marks a complete family request as warm", () => {
    const memory = { ...createEmptyMemory(), planType: { value: "familiar", confidence: 1 as const } };
    expect(deriveLeadQualificationStatus(memory)).toBe("warm");
  });

  it("marks explicit purchase intent as hot", () => {
    const memory = { ...createEmptyMemory(), intent: { value: "quero contratar agora", confidence: 1 as const } };
    expect(deriveLeadQualificationStatus(memory)).toBe("hot");
  });

  it("keeps a neutral completed qualification as qualified", () => {
    expect(deriveLeadQualificationStatus(createEmptyMemory())).toBe("qualified");
  });
});
