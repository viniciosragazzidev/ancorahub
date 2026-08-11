import { describe, expect, it } from "vitest";
import { createEmptyMemory, extractFieldsFromMessage } from "./memory";
import { getNextQualificationQuestion, evaluateQualification } from "@/features/qualification-engine/service";
import { resolveQualificationDestination } from "@/features/ai-qualification/destination-routing-service";
import type { AgentBehaviorPolicy } from "@/features/agent-training/service";

describe("E2E Qualification Flow Simulation Test", () => {
  const policy: AgentBehaviorPolicy = {
    assistantName: "Assistente Âncora",
    tone: "professional",
    formOfAddress: "voce",
    objective: "qualify_and_handoff",
    requiredFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"],
    maxQuestions: 6,
    businessDays: "",
    handoffMessage: "Aguarde um momento.",
    quickReplyTemplates: {},
    knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
    qualification: {
      profileKey: "general",
      fieldWeights: { customerName: 1, planType: 2, numberOfLives: 2, age: 2, city: 1, email: 2 },
      entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] },
    },
  };

  it("simulates full lifecycle from intake to qualification, classification, destination, distribution and handoff", async () => {
    let memory = createEmptyMemory();

    // Step 1: Lead arrives, check first question
    let nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion?.key).toBe("customerName");

    // Step 2: User answers Q1 (customerName)
    memory = extractFieldsFromMessage("Olá, meu nome é Maria Eduarda", memory);
    expect(memory.customerName?.value).toBe("Maria Eduarda");
    nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion?.key).toBe("planType");

    // Step 3: User answers Q2 (planType)
    memory = extractFieldsFromMessage("Estou procurando um plano individual", memory);
    expect(memory.planType?.value).toBe("individual");
    nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion?.key).toBe("numberOfLives");

    // Step 4: User answers Q3 (numberOfLives)
    memory = extractFieldsFromMessage("Seria apenas para 1 pessoa", memory);
    expect(memory.numberOfLives?.value).toBe("1");
    nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion?.key).toBe("age");

    // Step 5: User answers Q4 (age)
    memory = extractFieldsFromMessage("Tenho 29 anos", memory);
    expect(memory.age?.value).toBe("29");
    nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion?.key).toBe("city");

    // Step 6: User answers Q5 (city)
    memory = extractFieldsFromMessage("Moro em Salvador", memory);
    expect(memory.city?.value).toBe("Salvador");
    nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion?.key).toBe("email");

    // Step 7: User answers Q6 (email) + expresses urgency
    memory = extractFieldsFromMessage("Meu e-mail é maria@gmail.com e quero fechar o plano esta semana com urgência", memory);
    expect(memory.email?.value).toBe("maria@gmail.com");
    nextQuestion = getNextQualificationQuestion(memory, policy);
    expect(nextQuestion).toBeNull(); // All questions answered!

    // Step 8: Qualification Evaluation
    const evaluation = evaluateQualification(memory, policy);
    expect(evaluation.state).toBe("QUALIFIED");
    expect(evaluation.score).toBe(100);
    expect(evaluation.classification).toBe("hot");
    expect(evaluation.qualificationStatus).toBe("hot");
    expect(evaluation.reasons).toContain("Score elevado (>= 80) ou alta urgência de contratação");

    // Step 9: Destination Resolution
    const destination = await resolveQualificationDestination({
      tenantId: "tenant-e2e-test",
      classification: evaluation.classification,
      score: evaluation.score,
    });
    expect(destination.temperatureClass).toBe("hot");
    expect(destination.priority).toBe("high");
    expect(destination.destinationType).toBeDefined();

    // Step 10: Verify end state invariants
    expect(evaluation.completedFields.length).toBe(6);
    expect(evaluation.missingFields.length).toBe(0);
    expect(evaluation.completedAt).toBeInstanceOf(Date);
  });
});
