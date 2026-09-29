import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => { throw new Error("no database in unit tests"); }, schema: {} }));

import { createEmptyMemory, EMAIL_DECLINED, extractFieldsFromMessage, type ConversationMemory } from "@/features/ai-agent/memory";
import { getDefaultQuickReplyTemplates, isRetiredDefaultBody, matchFaqSituation, parseHumanRequest, resolveQuickReply } from "@/features/ai-agent/quick-reply";
import type { AgentBehaviorPolicy } from "@/features/agent-training/service";
import { composeQuestionReply, questionVariants, renderConversationVariables, summarizeQualification } from "./reply-composer";
import { resolveDeterministicQualificationTurn } from "./service";

const policy = {
  assistantName: "Ana", tone: "friendly", formOfAddress: "voce", objective: "qualify_and_handoff",
  requiredFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"], maxQuestions: 6, businessDays: "", handoffMessage: "Encaminho.", quickReplyTemplates: {}, knowledgePolicy: { enabled: false, requireSourceForCommercialClaims: true },
  qualification: { profileKey: "pf", fieldWeights: {}, entryRules: { origins: [], campaigns: [], leadTypes: [], branchIds: [], tags: [] } },
} satisfies AgentBehaviorPolicy;

const withName = (name: string): ConversationMemory => ({
  ...createEmptyMemory(),
  customerName: { value: name, confidence: 1 },
  customerFirstName: { value: name.split(" ")[0]!, confidence: 1 },
  collectedFields: ["customerName"],
});

const firstWord = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[\s,.!?:]+/)[0];

describe("reply composer", () => {
  it("asks the age according to who enters the plan", () => {
    const base = createEmptyMemory();
    expect(questionVariants("age", { ...base, planType: { value: "individual", confidence: 1 } })).toContain("Qual a sua idade?");
    expect(questionVariants("age", { ...base, planType: { value: "familiar", confidence: 1 }, numberOfLives: { value: "3", confidence: 1 } })).toContain("Quais as idades das 3 pessoas?");
    expect(questionVariants("age", { ...base, planType: { value: "empresarial", confidence: 1 } })).toContain("Qual a média de idade das pessoas do plano?");
    for (const text of [...questionVariants("age", base), ...questionVariants("age", { ...base, planType: { value: "individual", confidence: 1 } })]) {
      expect(text).not.toMatch(/benefici/i);
    }
  });

  it("keeps the keywords the extractor needs to read short answers", () => {
    const base = createEmptyMemory();
    for (const text of questionVariants("numberOfLives", base)) expect(text).toMatch(/quantas (pessoas|vidas)/i);
    for (const text of questionVariants("numberOfLives", { ...base, planType: { value: "empresarial", confidence: 1 } })) expect(text).toMatch(/quantas vidas/i);
    for (const plan of ["individual", "familiar", "empresarial"]) {
      for (const text of questionVariants("age", { ...base, planType: { value: plan, confidence: 1 } })) expect(text).toMatch(/idade|quantos anos/i);
    }
    for (const text of questionVariants("city", base)) expect(text).toMatch(/cidade/);
    for (const text of questionVariants("customerName", base)) expect(text).toMatch(/nome/);
    for (const text of questionVariants("email", base)) expect(text).toMatch(/e-mail/);
  });

  it("echoes the value just answered and gives the same text for the same seed", () => {
    const memory = { ...withName("Ana Souza"), city: { value: "Niterói", confidence: 1 as const } };
    const reply = composeQuestionReply({ key: "email", memory, answered: ["city"], seed: "c1:4", last: true });
    expect(reply).toMatch(/Niterói|Perfeito, Ana\./);
    expect(reply).toContain("Última pergunta: ");
    expect(composeQuestionReply({ key: "email", memory, answered: ["city"], seed: "c1:4", last: true })).toBe(reply);
  });

  it("never repeats the opener or the name of the previous message", () => {
    const memory = { ...withName("Ana Souza"), city: { value: "Niterói", confidence: 1 as const } };
    for (let turn = 0; turn < 50; turn += 1) {
      const previous = "Perfeito, Ana. Qual a sua idade?";
      const reply = composeQuestionReply({ key: "email", memory, answered: ["city"], previousReply: previous, seed: `s:${turn}` });
      expect(firstWord(reply)).not.toBe("perfeito");
      expect(reply).not.toContain("Ana");
    }
  });

  it("summarizes several answers given in one message", () => {
    const memory = extractFieldsFromMessage("É familiar, somos 3 pessoas", withName("Ana Souza"));
    const reply = composeQuestionReply({ key: "age", memory, answered: ["planType", "numberOfLives"], seed: "x" });
    expect(reply).toMatch(/^(Perfeito, a|A)notei: familiar e 3 pessoas\. /);
  });

  it("rephrases an unanswered question without a confirmation", () => {
    const reply = composeQuestionReply({ key: "city", memory: withName("Ana Souza"), answered: [], seed: "r", repeated: true });
    expect(reply).toMatch(/^(Só para eu registrar certinho|Para eu seguir com a cotação|Me ajuda com uma informação): /);
    expect(reply).toContain("cidade");
  });

  it("renders {{nome}} and {{resumo}} and drops them cleanly when empty", () => {
    const text = getDefaultQuickReplyTemplates()["human.requested"]!.body;
    expect(renderConversationVariables(text, createEmptyMemory())).toBe("Claro! Já passei seu atendimento para um corretor especialista com o que você me contou. Ele continua a conversa por aqui em instantes.");
    const memory = { ...withName("Torquato"), planType: { value: "individual", confidence: 1 as const }, age: { value: "40", confidence: 1 as const }, city: { value: "Itaboraí", confidence: 1 as const } };
    expect(summarizeQualification(memory)).toBe("individual, 40 anos e Itaboraí");
    expect(renderConversationVariables(text, memory)).toBe("Claro, Torquato! Já passei seu atendimento para um corretor especialista com o que você me contou (individual, 40 anos e Itaboraí). Ele continua a conversa por aqui em instantes.");
    expect(renderConversationVariables("Oi, {{nome}}!", createEmptyMemory(), "Lead WhatsApp (5521)")).toBe("Oi!");
  });
});

describe("mid-conversation situations", () => {
  it("recognizes the common questions", () => {
    expect(matchFaqSituation("Quanto custa?")).toBe("faq.price");
    expect(matchFaqSituation("qual o valor do plano")).toBe("faq.price");
    expect(matchFaqSituation("Vocês trabalham com Amil?")).toBe("faq.operators");
    expect(matchFaqSituation("tem carência?")).toBe("faq.waiting_period");
    expect(matchFaqSituation("Quem está falando?")).toBe("faq.who");
    expect(matchFaqSituation("Itaboraí")).toBeNull();
    expect(matchFaqSituation("40")).toBeNull();
  });

  it("answers a repeated request for a person with the reminder, not a second transfer", () => {
    const base = { isNewConversation: false, hasPriorMessages: true, hasPendingQuestion: false } as const;
    expect(resolveQuickReply({ ...base, body: "Falar com humano", conversationState: "AI_ACTIVE" })).toMatchObject({ intent: "REQUEST_HUMAN", templateKey: "human.requested" });
    expect(resolveQuickReply({ ...base, body: "Falar com humano", conversationState: "WAITING_HUMAN" })).toMatchObject({ ruleKey: "waiting_human", templateKey: "human.waiting_reminder" });
    expect(resolveQuickReply({ ...base, body: "Falar com humano", conversationState: "HUMAN_IN_PROGRESS" })).toMatchObject({ ruleKey: "human_already_contacted" });
  });

  it("replaces the old saved human-request text (which asked again for name and people) by the new default", () => {
    expect(isRetiredDefaultBody("human.requested", "Certo! Estou transferindo seu atendimento para a fila de um corretor especialista agora mesmo. Para agilizar seu atendimento, pode me informar seu nome e para quantas pessoas busca o plano?")).toBe(true);
    expect(isRetiredDefaultBody("human.requested", "Texto próprio da empresa.")).toBe(false);
  });

  it("closes a complete qualification with the summary, keeping a text the tenant wrote", () => {
    const done: ConversationMemory = {
      ...withName("Torquato"),
      planType: { value: "individual", confidence: 1 }, numberOfLives: { value: "1", confidence: 0 },
      age: { value: "40", confidence: 1 }, city: { value: "Itaboraí", confidence: 1 }, email: { value: "t@example.com", confidence: 1 },
      collectedFields: ["customerName", "planType", "numberOfLives", "age", "city", "email"],
    };
    expect(resolveDeterministicQualificationTurn({ memory: done, policy, handoffMessage: "Vou encaminhar você para um corretor da equipe agora." }).reply)
      .toBe("Obrigado, Torquato! Com essas informações (individual, 40 anos e Itaboraí), já passei seu atendimento para um corretor especialista. Ele continua a conversa por aqui em instantes.");
    expect(resolveDeterministicQualificationTurn({ memory: done, policy, handoffMessage: "Texto nosso." }).reply).toBe("Texto nosso.");
  });

  it("accepts declining the e-mail and moves on", () => {
    const asked = { ...createEmptyMemory(), lastQuestionAsked: "Última pergunta: qual o seu melhor e-mail para eu enviar a cotação?" };
    expect(extractFieldsFromMessage("Prefiro não informar", asked).email?.value).toBe(EMAIL_DECLINED);
    expect(extractFieldsFromMessage("não tenho", asked).email?.value).toBe(EMAIL_DECLINED);
    expect(extractFieldsFromMessage("não tenho", { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você vai usar o plano?" }).email).toBeUndefined();
  });
});

describe("the reported conversation (Torquato), end to end", () => {
  it("confirms, skips what it knows, never re-asks and closes with a summary", () => {
    let memory: ConversationMemory = { ...withName("Torquato"), lastQuestionAsked: "Oi, *Torquato*! Vi que você pediu uma cotação por aqui 😊 Posso entender rapidinho o que você está buscando?" };
    const sent: string[] = [memory.lastQuestionAsked!];
    const answer = (text: string, index: number) => {
      const before = memory.collectedFields;
      memory = extractFieldsFromMessage(text, memory, `m${index}`);
      const answered = memory.collectedFields.filter((field) => !before.includes(field))
        .filter((field) => !(field === "numberOfLives" && (memory.numberOfLives?.confidence ?? 1) < 1));
      const turn = resolveDeterministicQualificationTurn({
        memory, policy, pastOutboundTexts: new Set(sent.map((item) => item.toLowerCase())),
        answeredNow: answered.length > 0, answered, previousReply: sent[sent.length - 1], seed: `torquato:${sent.length}`,
      });
      sent.push(turn.reply);
      memory = { ...memory, lastQuestionAsked: turn.reply };
      return turn;
    };

    const plan = answer("Sim", 1);
    expect(plan.nextQuestion?.key).toBe("planType");
    expect(plan.reply).not.toMatch(/^Perfeito/);

    const age = answer("Individual", 2);
    expect(age.nextQuestion?.key).toBe("age");
    expect(age.reply).toMatch(/^(Individual, anotado!|Plano individual, perfeito\.|Certo, Torquato, só para você\.) (Qual a sua idade\?|Quantos anos você tem\?)$/);

    const city = answer("40", 3);
    expect(memory.age?.value).toBe("40");
    expect(city.nextQuestion?.key).toBe("city");

    const email = answer("Itaboraí", 4);
    expect(memory.city?.value).toBe("Itaboraí");
    expect(email.nextQuestion?.key).toBe("email");
    expect(email.reply).toContain("Última pergunta: ");

    // No question about the number of people, no "beneficiários", no repeated opener or name.
    const questions = sent.slice(1);
    expect(questions.some((text) => /quantas pessoas|benefici/i.test(text))).toBe(false);
    for (let index = 1; index < questions.length; index += 1) {
      expect(firstWord(questions[index]!)).not.toBe(firstWord(questions[index - 1]!));
      expect(questions[index]!.includes("Torquato") && questions[index - 1]!.includes("Torquato")).toBe(false);
    }

    expect(parseHumanRequest("Falar com humano")).toBe(true);
    const handoff = renderConversationVariables(getDefaultQuickReplyTemplates()["human.requested"]!.body, memory);
    expect(handoff).toBe("Claro, Torquato! Já passei seu atendimento para um corretor especialista com o que você me contou (individual, 40 anos e Itaboraí). Ele continua a conversa por aqui em instantes.");
    expect(handoff).not.toMatch(/nome|quantas pessoas/i);
  });
});
