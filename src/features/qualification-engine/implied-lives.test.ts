import { describe, expect, it } from "vitest";
import type { AgentBehaviorPolicy } from "@/features/agent-training/service";
import { mergeQualificationContextAnalysis, type QualificationContextAnalysis } from "@/features/ai-agent/context-analysis";
import { applyImpliedQualificationFacts, createEmptyMemory, extractFieldsFromMessage, type ConversationMemory } from "@/features/ai-agent/memory";
import { applyAiMemoryUpdates } from "@/features/ai-agent/qualification-fallback";
import { evaluateQualification, getNextQualificationQuestion, resolveDeterministicQualificationTurn } from "./service";

/**
 * Case Valter (10/11): asked "é um plano só seu, pra família ou pra empresa (CNPJ)?", he
 * answered "Para mim é um plano só" and the AI still asked "pra quantas pessoas, no total?".
 * An individual plan is one person; whatever path reads the plan, the lives question is skipped.
 */

const policy = {
  assistantName: "Luciana", tone: "friendly", formOfAddress: "voce", objective: "qualify_and_handoff",
  requiredFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"], maxQuestions: 6, businessDays: "", handoffMessage: "Encaminho.", quickReplyTemplates: {}, knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
  qualification: { profileKey: "pf", fieldWeights: {}, entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] } },
} satisfies AgentBehaviorPolicy;

const PLAN_QUESTION = "Boa tarde, Valter, aqui é Luciana, da Âncora Saúde. Pra eu montar as opções certas: é um plano só seu, pra família ou pra empresa (CNPJ)?";
const LIVES_QUESTION = /quantas (?:pessoas|vidas)/i;

function named(): ConversationMemory {
  return {
    ...createEmptyMemory(),
    customerName: { value: "Valter Souza", confidence: 1 },
    customerFirstName: { value: "Valter", confidence: 1 },
    collectedFields: ["customerName"],
    lastQuestionAsked: PLAN_QUESTION,
  };
}

function answerPlan(message: string) {
  const memory = extractFieldsFromMessage(message, named(), "msg-plan");
  const turn = resolveDeterministicQualificationTurn({ memory, policy, answered: ["planType"], previousReply: PLAN_QUESTION, seed: "valter:2" });
  return { memory, turn };
}

const analysis = (patch: Partial<QualificationContextAnalysis>): QualificationContextAnalysis => ({
  planType: null, companyHasCnpj: null, numberOfLives: null, ages: [], city: null, currentPlan: null, corrections: [], answeredLastQuestion: true,
  intents: { humanRequest: false, noInterest: false, priceQuestion: false, customerQuestion: false },
  confidence: { planType: 0, companyHasCnpj: 0, numberOfLives: 0, ages: 0, city: 0, currentPlan: 0, humanRequest: 0, noInterest: 0, priceQuestion: 0, customerQuestion: 0 },
  ...patch,
});

describe("individual plan implies one life", () => {
  it("case Valter: 'Para mim é um plano só' is individual, 1 life, and the next question is the age", () => {
    const { memory, turn } = answerPlan("Para mim é um plano só");
    expect(memory.planType?.value).toBe("individual");
    expect(memory.numberOfLives).toMatchObject({ value: "1", confidence: 0 });
    expect(turn.nextQuestion?.key).toBe("age");
    expect(turn.reply).not.toMatch(LIVES_QUESTION);
    expect(turn.reply).toMatch(/idade|quantos anos/i);
  });

  it.each(["Para mim é um plano só", "para mim e um plano so", "Só eu", "só eu mesmo", "Para mim", "pra mim", "Individual", "É individual", "Só meu", "Apenas pra mim"])(
    "'%s' skips the lives question",
    (message) => {
      const { memory, turn } = answerPlan(message);
      expect(memory.planType?.value).toBe("individual");
      expect(memory.numberOfLives?.value).toBe("1");
      expect(turn.nextQuestion?.key).toBe("age");
      expect(turn.reply).not.toMatch(LIVES_QUESTION);
    },
  );

  it("'eu e minha esposa' is a family plan of 2 and does not ask how many people", () => {
    const { memory, turn } = answerPlan("eu e minha esposa");
    expect(memory.planType?.value).toBe("familiar");
    expect(memory.numberOfLives).toMatchObject({ value: "2", confidence: 1 });
    expect(turn.nextQuestion?.key).toBe("age");
    expect(turn.reply).not.toMatch(LIVES_QUESTION);
    expect(turn.reply).toMatch(/2 pessoas/);
  });

  it("'pra mim e minha esposa' is also 2 lives", () => {
    const { memory } = answerPlan("pra mim e minha esposa");
    expect(memory.planType?.value).toBe("familiar");
    expect(memory.numberOfLives?.value).toBe("2");
  });

  it("'eu e meus filhos' is a family plan with an unknown count: the lives question is still asked", () => {
    const { memory, turn } = answerPlan("eu e meus filhos");
    expect(memory.planType?.value).toBe("familiar");
    expect(memory.numberOfLives).toBeUndefined();
    expect(turn.nextQuestion?.key).toBe("numberOfLives");
  });

  it("company (CNPJ) keeps asking the number of lives of the company", () => {
    const { memory, turn } = answerPlan("É pela empresa, tenho CNPJ");
    expect(memory.planType?.value).toBe("empresarial");
    expect(memory.numberOfLives).toBeUndefined();
    expect(turn.nextQuestion?.key).toBe("numberOfLives");
    expect(turn.reply).toMatch(/quantas vidas/i);
  });

  it("the plan corrected to individual by the context analysis also fills 1 life (the path of the real conversation)", () => {
    // Before the fix the rules read "Para mim é" as "para mim e [alguém]": familiar, no lives.
    const ruled: ConversationMemory = { ...named(), planType: { value: "familiar", confidence: 1, sourceMessageId: "msg-plan" }, collectedFields: ["customerName", "planType"] };
    const merged = mergeQualificationContextAnalysis({
      memory: ruled,
      baseMemory: named(),
      analysis: analysis({ planType: "individual", corrections: ["planType"], confidence: { ...analysis({}).confidence, planType: 0.95 } }),
      currentMessage: "Para mim é um plano só",
      previousQuestion: PLAN_QUESTION,
      sourceMessageId: "msg-plan",
    }).memory;
    expect(merged.planType?.value).toBe("individual");
    expect(merged.numberOfLives?.value).toBe("1");
    expect(getNextQualificationQuestion(merged, policy)?.key).toBe("age");
  });

  it("the plan read by the interpreter also fills 1 life", () => {
    const { memory } = applyAiMemoryUpdates(named(), [{ field: "planType", value: "individual", confidence: 1 }], "msg-plan", "Para mim é um plano só");
    expect(memory.numberOfLives?.value).toBe("1");
  });

  it("the engine never asks lives for an individual plan, even if the memory came without the implied life", () => {
    const memory: ConversationMemory = { ...named(), planType: { value: "individual", confidence: 1 }, collectedFields: ["customerName", "planType"] };
    expect(getNextQualificationQuestion(memory, policy)?.key).toBe("age");
    expect(evaluateQualification(memory, policy).missingFields).not.toContain("numberOfLives");
    const turn = resolveDeterministicQualificationTurn({ memory, policy, answered: ["planType"], seed: "x" });
    expect(turn.reply).not.toMatch(LIVES_QUESTION);
  });

  it("an implied life gives way when the plan becomes family or company; a said life stays", () => {
    const implied: ConversationMemory = { ...named(), planType: { value: "familiar", confidence: 1 }, numberOfLives: { value: "1", confidence: 0 }, collectedFields: ["customerName", "planType", "numberOfLives"] };
    const cleared = applyImpliedQualificationFacts(implied);
    expect(cleared.numberOfLives).toBeUndefined();
    expect(cleared.collectedFields).not.toContain("numberOfLives");
    const said: ConversationMemory = { ...implied, planType: { value: "empresarial", confidence: 1 }, numberOfLives: { value: "1", confidence: 1 } };
    expect(applyImpliedQualificationFacts(said)).toBe(said);
  });
});
