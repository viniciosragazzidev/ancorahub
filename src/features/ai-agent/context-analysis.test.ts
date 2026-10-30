import { describe, expect, it, vi } from "vitest";

import { createEmptyMemory, extractFieldsFromMessage, type ConversationMemory } from "./memory";
import {
  analyzeAndMergeQualificationContext,
  buildQualificationContextPrompt,
  isQualificationContextAnalysisEnabled,
  mergeQualificationContextAnalysis,
  parseQualificationContextResponse,
  qualificationContextAnalysisSettingKeys,
  redactQualificationContextText,
  type QualificationContextAnalysis,
} from "./context-analysis";

const confidence = {
  planType: 0.99,
  companyHasCnpj: 0.99,
  numberOfLives: 0.99,
  ages: 0.99,
  city: 0.99,
  currentPlan: 0.99,
  humanRequest: 0.99,
  noInterest: 0.99,
  priceQuestion: 0.99,
  customerQuestion: 0.99,
};

function result(overrides: Partial<QualificationContextAnalysis> = {}): QualificationContextAnalysis {
  return {
    planType: null,
    companyHasCnpj: null,
    numberOfLives: null,
    ages: [],
    city: null,
    currentPlan: null,
    corrections: [],
    answeredLastQuestion: false,
    intents: { humanRequest: false, noInterest: false, priceQuestion: false, customerQuestion: false },
    confidence,
    ...overrides,
  };
}

function memoryAfterRules(message: string, memory = createEmptyMemory(), question = "") {
  return extractFieldsFromMessage(message, { ...memory, lastQuestionAsked: question || undefined }, "msg-current");
}

async function mockedAnalysis(input: {
  message: string;
  analysis: QualificationContextAnalysis;
  memory?: ConversationMemory;
  question?: string;
}) {
  const model = vi.fn(async () => ({ content: JSON.stringify(input.analysis), model: "mock/model", provider: "mock" }));
  const initial = input.memory ?? createEmptyMemory();
  const regexMemory = memoryAfterRules(input.message, initial, input.question);
  const analyzed = await analyzeAndMergeQualificationContext({
    tenantId: "tenant-1",
    conversationId: "conversation-1",
    leadId: "lead-1",
    sourceMessageId: "msg-current",
    currentMessage: input.message,
    previousQuestion: input.question ?? "",
    messages: [{ role: "assistant", content: input.question ?? "" }, { role: "user", content: input.message }],
    memory: regexMemory,
    baseMemory: initial,
  }, { callModel: model, log: vi.fn() });
  return { ...analyzed, model };
}

describe("qualification context analysis", () => {
  it("redacts formatted and unformatted CPF and CNPJ before provider input", () => {
    const redacted = redactQualificationContextText("CPF 123.456.789-01 e 12345678901; CNPJ 12345678000199 e 12.345.678/0001-99");
    expect(redacted).toBe("CPF [CPF] e [CPF]; CNPJ [CNPJ] e [CNPJ]");
    expect(redacted).not.toMatch(/123[.\d/-]{8,}/);
  });

  it("redacts the full lead name and first name regardless of case or accents", () => {
    const redacted = redactQualificationContextText("João da Silva respondeu. JOAO confirmou. JOÃO DA SILVA também.", "João da Silva");
    expect(redacted).toBe("[NOME] respondeu. [NOME] confirmou. [NOME] também.");
    expect(redacted).not.toMatch(/jo[aã]o|silva/i);
  });

  it("redacts street addresses and CEP while preserving neighborhood and city", () => {
    const redacted = redactQualificationContextText("Rua das Flores, 123, Centro, Campinas; CEP 13050-123");
    expect(redacted).toBe("[ENDEREÇO], Centro, Campinas; CEP [CEP]");
  });

  it("redacts messages, pending question, and textual qualification memory in the prompt", () => {
    const memory = createEmptyMemory();
    memory.city = { value: "Campinas", confidence: 1 };
    memory.currentPlan = { value: "Plano de João da Silva", confidence: 1 };
    memory.lastQuestionAsked = "João, qual seu CPF 12345678901?";
    const prompt = buildQualificationContextPrompt({
      messages: [{ role: "assistant", content: "João, qual seu CEP?" }],
      currentMessage: "João da Silva mora na Avenida Brasil, 45, Centro, Campinas. Telefone (11) 98765-4321. E-mail joao@example.com",
      previousQuestion: "João, qual seu CPF 12345678901?",
      memory,
      leadName: "João da Silva",
    });
    const serialized = prompt.map((message) => message.content).join("\n");
    expect(serialized).toContain("[NOME]");
    expect(serialized).toContain("[ENDEREÇO]");
    expect(serialized).toContain("[CPF]");
    expect(serialized).toContain("[TELEFONE]");
    expect(serialized).toContain("[E-MAIL]");
    expect(serialized).not.toMatch(/jo[aã]o|silva|12345678901|98765-4321|joao@example\.com/i);
  });

  it("validates a JSON response and rejects invalid shapes", () => {
    expect(parseQualificationContextResponse(JSON.stringify(result({ planType: "familiar" })))).toMatchObject({
      planType: "familiar",
      ages: [],
    });
    expect(parseQualificationContextResponse("{not-json")).toBeNull();
    expect(parseQualificationContextResponse(JSON.stringify({ planType: "unknown" }))).toBeNull();
  });

  it("defaults to enabled and resolves tenant and queue disable keys without allowing queue override", () => {
    expect(qualificationContextAnalysisSettingKeys("tenant-1", "queue-2")).toEqual({
      tenant: "qualification_context_analysis_tenant-1",
      queue: "qualification_context_analysis_tenant-1_queue-2",
    });
    expect(isQualificationContextAnalysisEnabled({})).toBe(true);
    expect(isQualificationContextAnalysisEnabled({ tenantSetting: "false", queueSetting: "true" })).toBe(false);
    expect(isQualificationContextAnalysisEnabled({ queueSetting: "false" })).toBe(false);
    expect(isQualificationContextAnalysisEnabled({ aiQualificationEnabled: false })).toBe(false);
  });

  it("requires a correction term or a new grounded value for an existing field", () => {
    const current = createEmptyMemory();
    current.city = { value: "Niterói", confidence: 1, sourceMessageId: "older" };
    current.collectedFields.push("city");
    const proposed = result({
      city: "Itaboraí",
      corrections: ["city"],
      answeredLastQuestion: true,
    });

    const deniedCorrection = mergeQualificationContextAnalysis({
      memory: current,
      analysis: proposed,
      currentMessage: "Não,",
      previousQuestion: "Qual é a sua cidade?",
      sourceMessageId: "msg-current",
      baseMemory: current,
    });
    expect(deniedCorrection.memory.city?.value).toBe("Niterói");

    const groundedNewValue = mergeQualificationContextAnalysis({
      memory: current,
      analysis: proposed,
      currentMessage: "Minha cidade é Itaboraí",
      previousQuestion: "Qual é a sua cidade?",
      sourceMessageId: "msg-current",
      baseMemory: current,
    });
    expect(groundedNewValue.memory.city?.value).toBe("Itaboraí");

    const appliedCorrection = mergeQualificationContextAnalysis({
      memory: current,
      analysis: proposed,
      currentMessage: "Na verdade, minha cidade é Itaboraí",
      previousQuestion: "Qual é a sua cidade?",
      sourceMessageId: "msg-current",
      baseMemory: current,
    });
    expect(appliedCorrection.memory.city).toMatchObject({ value: "Itaboraí", confidence: 1, sourceMessageId: "msg-current" });
  });

  it("does not erase a confirmed value when the model returns no value", () => {
    const current = createEmptyMemory();
    current.city = { value: "Niterói", confidence: 1 };
    const merged = mergeQualificationContextAnalysis({
      memory: current,
      analysis: result({ city: null }),
      currentMessage: "Pode continuar",
      previousQuestion: "Qual cidade?",
      sourceMessageId: "msg-current",
      baseMemory: current,
    });
    expect(merged.memory.city?.value).toBe("Niterói");
  });

  it("allows the model to resolve a deterministic same-turn extraction when the customer explicitly corrects it", () => {
    const base = createEmptyMemory();
    base.city = { value: "Niterói", confidence: 1, sourceMessageId: "older" };
    const afterRules: ConversationMemory = { ...base, city: { value: "Itaboraí", confidence: 1, sourceMessageId: "msg-current" } };
    const merged = mergeQualificationContextAnalysis({
      memory: afterRules,
      analysis: result({ city: "Curitiba", corrections: ["city"] }),
      currentMessage: "Na verdade, minha cidade é Curitiba",
      previousQuestion: "Qual é a sua cidade?",
      sourceMessageId: "msg-current",
      baseMemory: base,
    });
    expect(merged.memory.city?.value).toBe("Curitiba");
  });

  it("falls back to the regex memory when the mocked model returns invalid JSON", async () => {
    const regexMemory = memoryAfterRules("Niterói", createEmptyMemory(), "Qual cidade?");
    const log = vi.fn();
    const analyzed = await analyzeAndMergeQualificationContext({
      tenantId: "tenant-1",
      conversationId: "conversation-1",
      leadId: "lead-1",
      sourceMessageId: "msg-current",
      currentMessage: "Niterói",
      previousQuestion: "Qual cidade?",
      messages: [{ role: "user", content: "Niterói" }],
      memory: regexMemory,
      baseMemory: createEmptyMemory(),
    }, { callModel: vi.fn(async () => ({ content: "sem JSON", model: "mock/model", provider: "mock" })), log });
    expect(analyzed).toMatchObject({ status: "fallback", analysis: null, memory: regexMemory });
    expect(log).toHaveBeenCalledWith(expect.objectContaining({ status: "fallback" }));
  });

  it("falls back after the short timeout without awaiting a stalled model", async () => {
    vi.useFakeTimers();
    try {
      const regexMemory = createEmptyMemory();
      const pending = analyzeAndMergeQualificationContext({
        tenantId: "tenant-1",
        conversationId: "conversation-1",
        leadId: "lead-1",
        currentMessage: "oi",
        previousQuestion: "",
        messages: [{ role: "user", content: "oi" }],
        memory: regexMemory,
        baseMemory: regexMemory,
      }, { callModel: vi.fn(() => new Promise<never>(() => undefined)), log: vi.fn(), timeoutMs: 10 });
      const settled = expect(pending).resolves.toMatchObject({ status: "fallback", memory: regexMemory });
      await vi.advanceTimersByTimeAsync(11);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not infer CNPJ or an enterprise plan from a denial, even when the mock model does", async () => {
    const analyzed = await mockedAnalysis({
      message: "Não tenho CNPJ",
      analysis: result({ planType: "empresarial", companyHasCnpj: true, answeredLastQuestion: true }),
      question: "O plano é para empresa ou pessoa física?",
    });
    expect(analyzed.model).toHaveBeenCalledOnce();
    expect(analyzed.memory.companyHasCnpj?.value).toBe("false");
    expect(analyzed.memory.planType).toBeUndefined();
  });

  it("accepts a direct CNPJ denial as an explicit correction to a previous positive value", () => {
    const previous = createEmptyMemory();
    previous.companyHasCnpj = { value: "true", confidence: 1, sourceMessageId: "older" };
    previous.collectedFields.push("companyHasCnpj");
    const merged = mergeQualificationContextAnalysis({
      memory: previous,
      baseMemory: previous,
      analysis: result({ companyHasCnpj: false, corrections: ["companyHasCnpj"] }),
      currentMessage: "Não tenho CNPJ",
      previousQuestion: "Sua empresa possui CNPJ?",
      sourceMessageId: "msg-current",
    });
    expect(merged.memory.companyHasCnpj?.value).toBe("false");
  });

  it("does not accept a family plan inferred from a denied family reference", () => {
    const merged = mergeQualificationContextAnalysis({
      memory: createEmptyMemory(),
      baseMemory: createEmptyMemory(),
      analysis: result({ planType: "familiar" }),
      currentMessage: "Não quero plano familiar, só eu",
      previousQuestion: "O plano é individual ou familiar?",
      sourceMessageId: "msg-current",
    });
    expect(merged.memory.planType).toBeUndefined();
  });

  it("understands a short individual-plan answer from the mocked model", async () => {
    const analyzed = await mockedAnalysis({
      message: "Só meu",
      analysis: result({ planType: "individual", answeredLastQuestion: true }),
      question: "O plano é só para você, família ou empresa?",
    });
    expect(analyzed.memory.planType?.value).toBe("individual");
    expect(analyzed.memory.numberOfLives).toMatchObject({ value: "1", confidence: 0 });
  });

  it("captures business, two lives, and each age from a multi-line answer", async () => {
    const analyzed = await mockedAnalysis({
      message: "CNPJ / Pra mim 70 / E meu marido 76",
      analysis: result({
        planType: "empresarial",
        companyHasCnpj: true,
        numberOfLives: 2,
        ages: [70, 76],
        answeredLastQuestion: true,
      }),
      question: "Quais são as idades das pessoas que vão usar o plano?",
    });
    expect(analyzed.memory).toMatchObject({
      planType: { value: "empresarial", confidence: 1 },
      companyHasCnpj: { value: "true", confidence: 1 },
      numberOfLives: { value: "2", confidence: 1 },
      age: { value: "70, 76", confidence: 1 },
      averageAge: { value: "73", confidence: 1 },
      beneficiaries: [{ age: 70, relation: null }, { age: 76, relation: null }],
    });
  });
});
