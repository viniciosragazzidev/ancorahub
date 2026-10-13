import { describe, expect, it } from "vitest";

import { cleanQualificationOrder, keepChosenOrder, questionTextProblem, readQuestionTexts } from "./domain";

describe("qualification flow", () => {
  it("keeps the chosen order, without repeated or unknown questions", () => {
    expect(cleanQualificationOrder(["city", "planType", "city", "x", 3])).toEqual(["city", "planType"]);
  });

  it("the settings checkboxes keep the order chosen in Fluxo and add new ones at the end", () => {
    expect(keepChosenOrder(["city", "planType", "age"], ["age", "planType", "email", "city"])).toEqual(["city", "planType", "age", "email"]);
    expect(keepChosenOrder(null, ["email", "city"])).toEqual(["email", "city"]);
  });

  it("asks for the words the answer reader needs", () => {
    expect(questionTextProblem("city", "Onde você mora?")).toMatch(/cidade/);
    expect(questionTextProblem("city", "De qual cidade você é?")).toBeNull();
    expect(questionTextProblem("numberOfLives", "Quantas vidas entram?")).toBeNull();
    expect(questionTextProblem("age", "Quantos anos vocês têm?")).toBeNull();
    expect(questionTextProblem("email", "Qual seu email?")).toBeNull();
    expect(questionTextProblem("customerName", "Oi")).toMatch(/entre 5 e 300/);
  });

  it("reads only known, non-empty texts", () => {
    expect(readQuestionTexts({ city: " De qual cidade? ", age: "", foo: "x" })).toEqual({ city: "De qual cidade?" });
    expect(readQuestionTexts(["x"])).toEqual({});
  });
});
