import { describe, expect, it } from "vitest";

import { factsFromQualification, plausibleCity } from "./facts";
import { openingMessages } from "./quote-messages";
import { cleanModelFacts } from "./turn-engine";

describe("abertura e cidade (caso Alex, 12/11)", () => {
  it("resposta solta gravada como cidade não vira cidade", () => {
    expect(plausibleCity("Só para mim")).toBe(false);
    expect(plausibleCity("Sim")).toBe(false);
    expect(plausibleCity("2 pessoas")).toBe(false);
    expect(plausibleCity("Niterói")).toBe(true);
    expect(plausibleCity("São Gonçalo")).toBe(true);
    expect(plausibleCity("Rio de Janeiro")).toBe(true);
    const facts = factsFromQualification({ nome: "Alex Ferreira", tipo: null, livesCount: null, collectedData: { cidade: "Só para mim" }, qualificationDetails: null, formData: null });
    expect(facts.city).toBeUndefined();
    expect(cleanModelFacts({ city: "só para mim" })).toEqual({});
    expect(cleanModelFacts({ city: "Niterói" })).toEqual({ city: "Niterói" });
  });

  it("a frase da abertura fica certa com ou sem idades e cidade", () => {
    const brokerageName = "Âncora Saúde";
    expect(openingMessages({ brokerageName, facts: { firstName: "Alex", city: "Niterói" } })[1]).toBe("Vi que você procura um plano de saúde em Niterói. Está certo?");
    expect(openingMessages({ brokerageName, facts: { ages: [30] } })[1]).toMatch(/^Vi que você procura um plano de saúde para .+\. Está certo\?$/);
    expect(openingMessages({ brokerageName, facts: {} })[1]).toBe("Vi que você procura um plano de saúde. Posso te ajudar a escolher?");
  });
});
