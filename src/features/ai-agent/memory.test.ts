import { describe, expect, it } from "vitest";

import { createEmptyMemory, extractFieldsFromMessage, isCoreQualificationComplete, COLLECTIBLE_FIELDS, readAgeList } from "./memory";

describe("number of lives in real conversations", () => {
  const asked = { ...createEmptyMemory(), lastQuestionAsked: "Perfeito, Maria. Quantas pessoas serão incluídas no plano?" };
  it("understands the answers a customer actually gave (pilot conversation)", () => {
    const first = extractFieldsFromMessage("Plano de saúde pra uma vida no mei", createEmptyMemory(), "m1");
    expect(first.numberOfLives?.value).toBe("1");
    expect(first.planType?.value).toBe("empresarial");
    expect(extractFieldsFromMessage("Quero ta uma vida.", asked).numberOfLives?.value).toBe("1");
    expect(extractFieldsFromMessage("Uma só", asked).numberOfLives?.value).toBe("1");
    expect(extractFieldsFromMessage("só eu", asked).numberOfLives?.value).toBe("1");
    expect(extractFieldsFromMessage("sozinha", asked).numberOfLives?.value).toBe("1");
    expect(extractFieldsFromMessage("somos 3 pessoas em casa", asked).numberOfLives?.value).toBe("3");
    expect(extractFieldsFromMessage("preciso pra duas vidas", createEmptyMemory()).numberOfLives?.value).toBe("2");
  });

  it("does not read an ordinary \"uma\" as a quantity", () => {
    expect(extractFieldsFromMessage("tenho uma dúvida", asked).numberOfLives).toBeUndefined();
    expect(extractFieldsFromMessage("uma pergunta antes", asked).numberOfLives).toBeUndefined();
    expect(extractFieldsFromMessage("só eu mesmo queria saber o preço", createEmptyMemory()).numberOfLives).toBeUndefined();
  });
});

describe("conversation memory", () => {
  it("records a bare number as lives when it answers the last lives question", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Quantas vidas serão incluídas no plano?" };

    const updated = extractFieldsFromMessage("3", memory, "msg-3");

    expect(updated.numberOfLives).toMatchObject({ value: "3", confidence: 1, sourceMessageId: "msg-3" });
    expect(updated.collectedFields).toContain("numberOfLives");
  });

  it("understands Portuguese number words in short lives answers", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Quantas pessoas serão incluídas no plano?" };

    expect(extractFieldsFromMessage("É só uma pessoa", memory).numberOfLives?.value).toBe("1");
    expect(extractFieldsFromMessage("É só uma", memory).numberOfLives?.value).toBe("1");
    expect(extractFieldsFromMessage("Duas vidas", memory).numberOfLives?.value).toBe("2");
  });

  it("understands pessoa física as an individual plan", () => {
    const updated = extractFieldsFromMessage(
      "Pessoa física",
      createEmptyMemory(),
      "msg-plan-type",
    );

    expect(updated.planType).toMatchObject({
      value: "individual",
      confidence: 1,
      sourceMessageId: "msg-plan-type",
    });
    expect(updated.collectedFields).toContain("planType");
  });

  it("captures a bare city answer when the previous question asks for city", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você mora?" };
    const updated = extractFieldsFromMessage("Nova Iguaçu, RJ", memory, "msg-city");

    expect(updated.city).toMatchObject({ value: "Nova Iguaçu", confidence: 1 });
    expect(updated.collectedFields).toContain("city");
  });

  it("does not mistake a sentence about leaving for lessons as a city", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você pretende utilizar o plano de saúde?" };

    const updated = extractFieldsFromMessage(
      "Estou saindo p dar aulas, logo voltarei a ler.",
      memory,
      "msg-non-city",
    );

    expect(updated.city).toBeUndefined();
    expect(updated.collectedFields).not.toContain("city");
  });

  it("keeps a valid multi-word city answer after a comma", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você pretende utilizar o plano de saúde?" };

    const updated = extractFieldsFromMessage("Cabo Frio, RJ", memory, "msg-cabo-frio");

    expect(updated.city?.value).toBe("Cabo Frio");
  });

  it("captures all ages supplied together for a family", () => {
    const memory = { ...createEmptyMemory(), lastQuestionAsked: "Qual é a idade da pessoa que será incluída?" };
    const updated = extractFieldsFromMessage("13,33,36", memory, "msg-ages");

    expect(updated.age).toMatchObject({ value: "13, 33, 36", confidence: 1 });
    expect(updated.collectedFields).toContain("age");
  });

  it("captures only the average age for a PME group", () => {
    const memory = {
      ...createEmptyMemory(),
      planType: { value: "empresarial", confidence: 1 as const },
      numberOfLives: { value: "18", confidence: 1 as const },
      lastQuestionAsked: "Para dimensionar as opções para a empresa, qual é a média aproximada de idade do grupo?",
    };
    const updated = extractFieldsFromMessage("36 anos", memory, "msg-average-age");

    expect(updated.averageAge).toMatchObject({ value: "36", confidence: 1, sourceMessageId: "msg-average-age" });
    expect(updated.age).toBeUndefined();
  });

  it("extracts every fact from a long PME answer and uses individual ages as the average-age signal", () => {
    const updated = extractFieldsFromMessage(
      "No nosso caso é a empresa MEI da minha esposa. Seriam 2 vidas. Tenho 62 anos e ela 61. Gostaríamos de ver opções mais baratas, pois moramos no Recreio dos Bandeirantes.",
      { ...createEmptyMemory(), lastQuestionAsked: "Você busca um plano individual/familiar ou para empresa (PJ)?" },
      "msg-long-pme",
    );

    expect(updated.customerName).toBeUndefined();
    expect(updated.planType?.value).toBe("empresarial");
    expect(updated.numberOfLives?.value).toBe("2");
    expect(updated.averageAge?.value).toBe("62");
    expect(updated.age).toBeUndefined();
    expect(updated.city?.value).toBe("Recreio dos Bandeirantes");
    expect(updated.intent?.value).toMatch(/opções mais baratas/i);
    expect(updated.collectedFields).toEqual(expect.arrayContaining(["planType", "numberOfLives", "age", "city", "intent"]));
  });

  it("keeps the six-question qualification order and detects completion", () => {
    expect(COLLECTIBLE_FIELDS.slice(0, 6).map((field) => field.key)).toEqual([
      "customerName", "planType", "numberOfLives", "age", "city", "email",
    ]);
    const memory = {
      ...createEmptyMemory(),
      customerName: { value: "Maria Silva", confidence: 1 as const },
      planType: { value: "familiar", confidence: 1 as const },
      numberOfLives: { value: "3", confidence: 1 as const },
      age: { value: "13, 33, 36", confidence: 1 as const },
      city: { value: "Nova Iguaçu", confidence: 1 as const },
      email: { value: "maria@example.com", confidence: 1 as const },
    };
    expect(isCoreQualificationComplete(memory)).toBe(true);
  });

  it("uses average age instead of individual ages to complete a PME qualification", () => {
    const memory = {
      ...createEmptyMemory(),
      customerName: { value: "Empresa Exemplo", confidence: 1 as const },
      planType: { value: "empresarial", confidence: 1 as const },
      numberOfLives: { value: "18", confidence: 1 as const },
      averageAge: { value: "36", confidence: 1 as const },
      city: { value: "São Paulo", confidence: 1 as const },
      email: { value: "rh@exemplo.com", confidence: 1 as const },
    };
    expect(isCoreQualificationComplete(memory)).toBe(true);
  });
});

describe("ages listed in one answer (Fabiane's conversation)", () => {
  const askedPlan = { ...createEmptyMemory(), lastQuestionAsked: "O plano seria individual, familiar ou empresarial (CNPJ)?" };
  it("reads \"Para 12 , 42 anos\" as two people aged 12 and 42, not 12 lives", () => {
    const memory = extractFieldsFromMessage("Para 12 , 42 anos", askedPlan, "m1");
    expect(memory.numberOfLives?.value).toBe("2");
    expect(memory.age?.value).toBe("12, 42");
  });

  it("reads the other ways of listing ages", () => {
    expect(readAgeList("12anos e 42 anos")).toEqual([12, 42]);
    expect(readAgeList("30 e 32 anos")).toEqual([30, 32]);
    expect(readAgeList("somos 3 pessoas, 30 e 32 anos")).toEqual([30, 32]);
    expect(readAgeList("2 vidas")).toEqual([]);
    expect(extractFieldsFromMessage("12anos e 42 anos", askedPlan).numberOfLives?.value).toBe("2");
  });

  it("still reads a quantity said with \"para\" next to people, or as the answer to the lives question", () => {
    const askedLives = { ...createEmptyMemory(), lastQuestionAsked: "Quantas pessoas serão incluídas no plano?" };
    expect(extractFieldsFromMessage("para 3 pessoas", askedPlan).numberOfLives?.value).toBe("3");
    expect(extractFieldsFromMessage("para 4", askedLives).numberOfLives?.value).toBe("4");
    expect(extractFieldsFromMessage("Para 12", askedPlan).numberOfLives).toBeUndefined();
  });
});

describe("Michele's conversation (a plan for a 16-day-old grandchild)", () => {
  const askedAge = { ...createEmptyMemory(), planType: { value: "individual", confidence: 1 as const }, lastQuestionAsked: "Qual a idade de quem vai usar o plano?" };
  it("reads a baby's age in days, weeks or months as 0 years", () => {
    expect(extractFieldsFromMessage("Mas é o bebê de 16 dias", askedAge).age?.value).toBe("0");
    expect(extractFieldsFromMessage("tem 3 meses", askedAge).age?.value).toBe("0");
    expect(extractFieldsFromMessage("Tenho 42 anos", askedAge).age?.value).toBe("42");
  });

  it("a message read without the city question is not a city", () => {
    expect(extractFieldsFromMessage("Faz uma coisa", createEmptyMemory()).city).toBeUndefined();
    const askedCity = { ...createEmptyMemory(), lastQuestionAsked: "Em qual cidade você vai usar o plano?" };
    expect(extractFieldsFromMessage("Seria mais em Resende", askedCity).city?.value ?? "").not.toBe("Faz uma coisa");
  });
});
