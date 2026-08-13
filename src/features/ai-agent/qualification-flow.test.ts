import { describe, expect, it } from "vitest";
import {
  evaluateQualification,
  getNextQualificationQuestion,
  resolveDeterministicQualificationTurn,
  shouldStartOrResumeAiQualification,
} from "@/features/qualification-engine/service";
import { createEmptyMemory, extractFieldsFromMessage, type ConversationMemory } from "./memory";
import { resolveQualificationDestination } from "@/features/ai-qualification/destination-routing-service";
import type { AgentBehaviorPolicy } from "@/features/agent-training/service";

describe("Qualification Flow Unit Tests", () => {
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

  describe("re-entry after the assistant is enabled", () => {
    it("allows an existing lead with pending qualification to start or resume through WhatsApp", () => {
      expect(shouldStartOrResumeAiQualification("pending")).toBe(true);
    });

    it.each(["qualified", "hot", "warm", "cold", "lost", "unknown"]) (
      "does not restart qualification once the lead is no longer pending (%s)",
      (qualificationStatus) => {
        expect(shouldStartOrResumeAiQualification(qualificationStatus)).toBe(false);
      },
    );
  });

  describe("getNextQualificationQuestion", () => {
    it("returns customerName (Q1) when memory is empty", () => {
      const memory = createEmptyMemory();
      const next = getNextQualificationQuestion(memory, policy);
      expect(next).not.toBeNull();
      expect(next?.key).toBe("customerName");
      expect(next?.id).toBe("Q1");
    });

    it("returns planType (Q2) when customerName is collected", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Carlos Silva", confidence: 1 },
        collectedFields: ["customerName"],
      };
      const next = getNextQualificationQuestion(memory, policy);
      expect(next?.key).toBe("planType");
      expect(next?.id).toBe("Q2");
    });

    it("returns numberOfLives (Q3) when customerName and planType are collected", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Carlos Silva", confidence: 1 },
        planType: { value: "individual", confidence: 1 },
        collectedFields: ["customerName", "planType"],
      };
      const next = getNextQualificationQuestion(memory, policy);
      expect(next?.key).toBe("numberOfLives");
      expect(next?.id).toBe("Q3");
    });

    it("returns age (Q4) when customerName, planType and numberOfLives are collected", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Carlos Silva", confidence: 1 },
        planType: { value: "individual", confidence: 1 },
        numberOfLives: { value: "2", confidence: 1 },
        collectedFields: ["customerName", "planType", "numberOfLives"],
      };
      const next = getNextQualificationQuestion(memory, policy);
      expect(next?.key).toBe("age");
      expect(next?.id).toBe("Q4");
    });

    it("returns city (Q5) when age is also collected", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Carlos Silva", confidence: 1 },
        planType: { value: "individual", confidence: 1 },
        numberOfLives: { value: "2", confidence: 1 },
        age: { value: "35 e 32 anos", confidence: 1 },
        collectedFields: ["customerName", "planType", "numberOfLives", "age"],
      };
      const next = getNextQualificationQuestion(memory, policy);
      expect(next?.key).toBe("city");
      expect(next?.id).toBe("Q5");
    });

    it("returns email (Q6) when all previous fields except email are collected", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Carlos Silva", confidence: 1 },
        planType: { value: "individual", confidence: 1 },
        numberOfLives: { value: "2", confidence: 1 },
        age: { value: "35 e 32 anos", confidence: 1 },
        city: { value: "Salvador", confidence: 1 },
        collectedFields: ["customerName", "planType", "numberOfLives", "age", "city"],
      };
      const next = getNextQualificationQuestion(memory, policy);
      expect(next?.key).toBe("email");
      expect(next?.id).toBe("Q6");
    });

    it("returns null when all 6 required fields are collected", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Carlos Silva", confidence: 1 },
        planType: { value: "individual", confidence: 1 },
        numberOfLives: { value: "2", confidence: 1 },
        age: { value: "35 e 32 anos", confidence: 1 },
        city: { value: "Salvador", confidence: 1 },
        email: { value: "carlos@email.com", confidence: 1 },
        collectedFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"],
      };
      const next = getNextQualificationQuestion(memory, policy);
      expect(next).toBeNull();
    });
  });

  describe("Multi-field extraction in single message", () => {
    it("extracts name, city and planType simultaneously and advances to next missing question", () => {
      const baseMemory = createEmptyMemory();
      const messageText = "Meu nome é Roberto Alves, moro em Curitiba e quero um plano individual";
      const updatedMemory = extractFieldsFromMessage(messageText, baseMemory);

      expect(updatedMemory.customerName?.value).toBe("Roberto Alves");
      expect(updatedMemory.city?.value).toBe("Curitiba");
      expect(updatedMemory.planType?.value).toBe("individual");

      // Next question should skip customerName, planType and city, and ask numberOfLives!
      const next = getNextQualificationQuestion(updatedMemory, policy);
      expect(next?.key).toBe("numberOfLives");
      expect(next?.id).toBe("Q3");
    });
  });

  describe("deterministic WhatsApp progression", () => {
    it("never repeats lives and hands off exactly after the email in the reported family-plan flow", () => {
      let memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Cliente de teste", confidence: 1 },
        customerFirstName: { value: "Cliente", confidence: 1 },
        collectedFields: ["customerName"],
        lastQuestionAsked: "Você busca um plano individual/familiar ou para empresa (PJ)?",
      };

      memory = extractFieldsFromMessage("Familiar", memory, "m1");
      let turn = resolveDeterministicQualificationTurn({ memory, policy, handoffMessage: "Vou transferir você para um corretor agora." });
      expect(turn.kind).toBe("collecting");
      expect(turn.nextQuestion?.key).toBe("numberOfLives");

      memory = extractFieldsFromMessage("3", { ...memory, lastQuestionAsked: turn.reply }, "m2");
      turn = resolveDeterministicQualificationTurn({ memory, policy, handoffMessage: "Vou transferir você para um corretor agora." });
      expect(turn.nextQuestion?.key).toBe("age");

      memory = extractFieldsFromMessage("17,44,43", { ...memory, lastQuestionAsked: turn.reply }, "m3");
      turn = resolveDeterministicQualificationTurn({ memory, policy, handoffMessage: "Vou transferir você para um corretor agora." });
      expect(turn.nextQuestion?.key).toBe("city");

      memory = extractFieldsFromMessage("Rio de Janeiro, centro", { ...memory, lastQuestionAsked: turn.reply }, "m4");
      turn = resolveDeterministicQualificationTurn({ memory, policy, handoffMessage: "Vou transferir você para um corretor agora." });
      expect(turn.nextQuestion?.key).toBe("email");

      memory = extractFieldsFromMessage("cliente.teste@example.com", { ...memory, lastQuestionAsked: turn.reply }, "m5");
      turn = resolveDeterministicQualificationTurn({ memory, policy, handoffMessage: "Vou transferir você para um corretor agora." });

      expect(turn.kind).toBe("handoff");
      expect(turn.evaluation.state).toBe("QUALIFIED");
      expect(turn.reply).toBe("Vou transferir você para um corretor agora.");
      expect(turn.nextQuestion).toBeNull();
    });
  });

  describe("evaluateQualification & Deterministic Classification", () => {
    it("classifies as HOT when score >= 80 or high urgency intent", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Ana Lima", confidence: 1 },
        planType: { value: "individual", confidence: 1 },
        numberOfLives: { value: "1", confidence: 1 },
        age: { value: "28", confidence: 1 },
        city: { value: "Belo Horizonte", confidence: 1 },
        email: { value: "ana@gmail.com", confidence: 1 },
        intent: { value: "Quero fechar urgente esta semana", confidence: 1 },
        collectedFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"],
      };

      const result = evaluateQualification(memory, policy);
      expect(result.state).toBe("QUALIFIED");
      expect(result.score).toBe(100);
      expect(result.classification).toBe("hot");
      expect(result.qualificationStatus).toBe("hot");
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it("classifies as WARM when human is requested during partial qualification", () => {
      const memory: ConversationMemory = {
        ...createEmptyMemory(),
        customerName: { value: "Empresa X", confidence: 1 },
        planType: { value: "empresarial", confidence: 1 },
        numberOfLives: { value: "5", confidence: 1 },
        collectedFields: ["customerName", "planType", "numberOfLives"],
      };

      const result = evaluateQualification(memory, policy, "human_requested");
      expect(result.state).toBe("PARTIAL");
      expect(result.classification).toBe("warm");
    });

    it("classifies as not_qualified when client signals not_interested", () => {
      const memory = createEmptyMemory();
      const result = evaluateQualification(memory, policy, "not_interested");
      expect(result.state).toBe("NOT_INTERESTED");
      expect(result.classification).toBe("not_qualified");
      expect(result.reasons).toContain("Lead sinalizou falta de interesse");
    });
  });

  describe("resolveQualificationDestination", () => {
    it("resolves destination for HOT lead to high priority and short SLA", async () => {
      const dest = await resolveQualificationDestination({
        tenantId: "test-tenant",
        classification: "hot",
        score: 95,
      });

      expect(dest.temperatureClass).toBe("hot");
      expect(dest.priority).toBe("high");
      expect(dest.slaMinutes).toBeLessThanOrEqual(5);
    });

    it("resolves destination for WARM lead to normal priority queue", async () => {
      const dest = await resolveQualificationDestination({
        tenantId: "test-tenant",
        classification: "warm",
        score: 65,
      });

      expect(dest.priority).toBe("normal");
    });

    it("resolves destination for not_qualified lead to close/no_distribution", async () => {
      const dest = await resolveQualificationDestination({
        tenantId: "test-tenant",
        classification: "not_qualified",
        score: 0,
      });

      expect(dest.destinationType).toMatch(/close|no_distribution/);
    });
  });
});
