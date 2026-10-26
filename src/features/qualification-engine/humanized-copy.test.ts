import { describe, expect, it } from "vitest";

import { createEmptyMemory, type ConversationMemory } from "@/features/ai-agent/memory";
import {
  BENEFICIARY_RELATION_INVITATION_VARIANTS,
  beneficiaryRelationInvitation,
  confirmationVariants,
  composeGreeting,
  composeQuestionReply,
  currentPlanQuestionVariants,
  greetingForHour,
  priceConcernLine,
  LAST_QUESTION_LEAD_INS,
  LEGACY_QUESTION_TEXTS,
  questionVariants,
  REPEATED_QUESTION_LEAD_INS,
  shouldAddPriceConcern,
  shouldUsePeriodGreeting,
  wasQuestionAsked,
  type QualificationFieldKey,
} from "./reply-composer";

const memoryFor = (planType: "individual" | "familiar" | "empresarial"): ConversationMemory => ({
  ...createEmptyMemory(),
  customerName: { value: "Ana Souza", confidence: 1 },
  customerFirstName: { value: "Ana", confidence: 1 },
  planType: { value: planType, confidence: 1 },
  numberOfLives: { value: planType === "individual" ? "1" : "2", confidence: 1 },
  ...(planType === "empresarial" ? {} : { age: { value: "35,32", confidence: 1 as const } }),
  averageAge: planType === "empresarial" ? { value: "35", confidence: 1 } : undefined,
  city: { value: "Niterói", confidence: 1 },
  neighborhood: { value: "Icaraí", confidence: 1 },
  email: { value: "ana@example.com", confidence: 1 },
});

function sentenceCount(text: string) {
  return (text.match(/[.!?](?=\s|$)/g) ?? []).length;
}

function reviewedVariants() {
  const variants: string[] = [
    ...REPEATED_QUESTION_LEAD_INS,
    ...LAST_QUESTION_LEAD_INS,
    ...BENEFICIARY_RELATION_INVITATION_VARIANTS,
  ];
  for (const plan of ["individual", "familiar", "empresarial"] as const) {
    const memory = memoryFor(plan);
    variants.push(...currentPlanQuestionVariants(memory));
    for (let seed = 0; seed < 30; seed += 1) {
      const priceLine = priceConcernLine("O valor do plano está caro demais", { lives: 2, seed: `copy-price-${seed}` });
      if (priceLine) variants.push(priceLine);
    }
    for (const key of ["customerName", "planType", "numberOfLives", "age", "city", "email"] as const) {
      variants.push(...questionVariants(key, memory));
      variants.push(...confirmationVariants(key, memory, "Ana"));
    }
  }
  return variants;
}

describe("copy reviewed for WhatsApp", () => {
  it.each([
    ["04:59", 4, 59, "Boa noite"],
    ["05:00", 5, 0, "Bom dia"],
    ["11:59", 11, 59, "Bom dia"],
    ["12:00", 12, 0, "Boa tarde"],
    ["17:59", 17, 59, "Boa tarde"],
    ["18:00", 18, 0, "Boa noite"],
    ["23:59", 23, 59, "Boa noite"],
    ["00:00", 0, 0, "Boa noite"],
  ])("uses São Paulo time at %s", (_label, hour, minute, expected) => {
    const date = new Date(Date.UTC(2026, 9, 26, Number(hour) + 3, Number(minute)));
    expect(greetingForHour(date)).toBe(expected);
  });

  it("greets at the opening and after six full hours of silence", () => {
    const now = new Date("2026-10-26T15:00:00.000Z");
    expect(shouldUsePeriodGreeting(null, now)).toBe(true);
    expect(shouldUsePeriodGreeting(new Date(now.getTime() - 5 * 60 * 60_000 - 59 * 60_000), now)).toBe(false);
    expect(shouldUsePeriodGreeting(new Date(now.getTime() - 6 * 60 * 60_000), now)).toBe(true);
    expect(composeGreeting({ name: "Ana Souza", assistantName: "Lia", companyName: "Âncora Saúde", seed: "s", now }))
      .toBe("Boa tarde, Ana, aqui é Lia, da Âncora Saúde.");
  });

  it("does not repeat any of the last three openers", () => {
    const reply = composeQuestionReply({
      key: "city",
      memory: memoryFor("individual"),
      answered: ["numberOfLives"],
      recentReplies: ["Prazer, Ana!", "Anotei a sua idade.", "Ótimo, obrigado."],
      seed: "three-recent-replies",
    });
    const first = reply.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[\s,.!?:]+/)[0];
    expect(["prazer", "anotei", "otimo"]).not.toContain(first);
  });

  it("keeps composed replies within three sentences and one question in each greeting state", () => {
    const now = new Date("2026-10-26T15:00:00.000Z");
    const cases: Array<{
      answered: QualificationFieldKey[];
      askCurrentPlan?: boolean;
      last?: boolean;
      repeated?: boolean;
      greetingText?: string;
      periodGreeting?: boolean;
      now?: Date;
    }> = [
      { answered: ["numberOfLives"], askCurrentPlan: true, last: true },
      { answered: [], repeated: true },
      { answered: [], greetingText: "Boa tarde, Ana, aqui é Lia, da Âncora Saúde.", now },
      { answered: [], periodGreeting: true, now },
    ];
    for (const plan of ["individual", "familiar", "empresarial"] as const) {
      for (const key of ["planType", "numberOfLives", "age", "city", "email"] as const) {
        for (const options of cases) {
          for (let seed = 0; seed < 12; seed += 1) {
            const reply = composeQuestionReply({ key, memory: memoryFor(plan), seed: `${plan}:${key}:${seed}`, ...options });
            expect(sentenceCount(reply), reply).toBeLessThanOrEqual(3);
            expect((reply.match(/\?/g) ?? []).length, reply).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it("keeps a director's custom text byte-for-byte as authored", () => {
    const customText = "  Me conta do seu jeito, por favor?  ";
    expect(composeQuestionReply({ key: "city", memory: memoryFor("individual"), answered: [], seed: "custom", customText, periodGreeting: true }))
      .toBe(customText);
  });

  it("does not prepend an automatic price line to a director's custom question", () => {
    const concern = priceConcernLine("O valor do plano está caro", { lives: 2, seed: "custom-price" });
    expect(shouldAddPriceConcern(concern, "Pergunta escrita pelo diretor?  ")).toBe(false);
    expect(shouldAddPriceConcern(concern, " ")).toBe(true);
    expect(shouldAddPriceConcern(null, null)).toBe(false);
  });

  it("recognizes every previous question wording as already asked", () => {
    const memory = memoryFor("individual");
    for (const [key, variants] of Object.entries(LEGACY_QUESTION_TEXTS) as Array<[QualificationFieldKey, readonly string[]]>) {
      for (const oldText of variants) {
        expect(wasQuestionAsked(key, memory, questionVariants(key, memory)[0]!, [oldText]), `${key}: ${oldText}`).toBe(true);
      }
    }
    expect(wasQuestionAsked("email", memory, "Qual é o seu melhor e-mail?", ["Anotei o e-mail. Não se preocupe.", LEGACY_QUESTION_TEXTS.email![0]!])).toBe(true);
  });

  it("keeps the extractor keywords in the new question variants", () => {
    for (const plan of ["individual", "familiar", "empresarial"] as const) {
      const memory = memoryFor(plan);
      for (const text of questionVariants("customerName", memory)) expect(text).toMatch(/nome/i);
      for (const text of questionVariants("planType", memory)) expect(text).toMatch(/individual|familiar|empresa|CNPJ/i);
      for (const text of questionVariants("numberOfLives", memory)) expect(text).toMatch(plan === "empresarial" ? /quantas vidas/i : /quantas pessoas/i);
      for (const text of questionVariants("age", memory)) expect(text).toMatch(/idade|idades|quantos anos/i);
      for (const text of questionVariants("city", memory)) expect(text).toMatch(/cidade|bairro/i);
      for (const text of questionVariants("email", memory)) expect(text).toMatch(/e-mail/i);
      for (const text of currentPlanQuestionVariants(memory)) expect(text).toMatch(/plano de saúde hoje/i);
    }
  });

  it("keeps every reviewed copy within three sentences, one question and no emoji or typographic dash", () => {
    for (const text of reviewedVariants()) {
      expect(sentenceCount(text), text).toBeLessThanOrEqual(3);
      expect((text.match(/\?/g) ?? []).length, text).toBeLessThanOrEqual(1);
      expect(text, text).not.toMatch(/[\u2012-\u2015\u2212]/);
      expect(text, text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });

  it("offers relationships only once for two or more personal plan ages", () => {
    const family = { ...memoryFor("familiar"), age: { value: "46 e 10", confidence: 1 as const } };
    expect(beneficiaryRelationInvitation(family, "first")).toBeTruthy();
    expect(beneficiaryRelationInvitation({ ...family, relationAsked: true }, "asked")).toBeNull();
    expect(beneficiaryRelationInvitation({ ...family, beneficiaries: [{ age: 46, relation: "titular" }, { age: 10, relation: null }] }, "answered")).toBeNull();
    expect(beneficiaryRelationInvitation({ ...family, age: { value: "46", confidence: 1 } }, "one-age")).toBeNull();
    expect(beneficiaryRelationInvitation({ ...memoryFor("empresarial"), age: { value: "46 e 10", confidence: 1 } }, "business")).toBeNull();
    expect(new Set(BENEFICIARY_RELATION_INVITATION_VARIANTS).size).toBe(BENEFICIARY_RELATION_INVITATION_VARIANTS.length);
  });

  it("acknowledges price concerns with one calm sentence", () => {
    const lines = Array.from({ length: 12 }, (_, index) => priceConcernLine("O valor está caro demais", { lives: 2, seed: `price:${index}` }));
    expect(lines.every(Boolean)).toBe(true);
    expect(new Set(lines).size).toBe(3);
    for (const text of lines) {
      expect(sentenceCount(text!), text!).toBe(1);
      expect(text).not.toMatch(/[\u2012-\u2015\u2212]/);
    }
  });

  it("keeps question coverage complete for every field", () => {
    const keys: QualificationFieldKey[] = ["customerName", "planType", "numberOfLives", "age", "city", "email"];
    expect(Object.keys(LEGACY_QUESTION_TEXTS).sort()).toEqual(keys.sort());
  });
});
