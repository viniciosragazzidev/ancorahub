import { describe, expect, it } from "vitest";

import { brokerGreeting, greetingFactsFromQualification } from "./broker-greeting";

describe("broker first message (29/10)", () => {
  it("introduces the broker and the brokerage, answers right away and ends with one question", () => {
    const text = brokerGreeting({ leadName: "Wânia Souza", brokerName: "Renan Lima", companyName: "Âncora Saúde", tipo: "PF" });
    expect(text).toBe([
      "Oi, Wânia, tudo bem? Aqui é Renan, da Âncora Saúde. Acabei de receber seu pedido de cotação de plano de saúde e vou cuidar dele pessoalmente.",
      "Comparo as principais operadoras pra te mostrar as opções que cabem no seu orçamento, com a cobertura que você precisa.",
      "Pra eu já te mandar os valores: o plano seria só pra você ou pra mais alguém da família?",
    ].join("\n\n"));
    expect(text.match(/\?/g)).toHaveLength(2);
    expect(text).not.toMatch(/[—–]|\p{Extended_Pictographic}/u);
  });

  it("does not ask again what the lead already told: with the lives it asks the ages", () => {
    const text = brokerGreeting({ leadName: "Wânia", brokerName: "Renan", tipo: "PF", livesCount: 3, planName: "Amil 400" });
    expect(text).toContain("seu pedido de cotação do plano Amil 400");
    expect(text).not.toContain("mais alguém");
    expect(text).toContain("qual a idade de cada pessoa que vai entrar no plano?");
  });

  it("talks to the company on a PME lead", () => {
    const text = brokerGreeting({ leadName: "Carlos", brokerName: "Ana", companyName: "Âncora Saúde", tipo: "PME" });
    expect(text).toContain("plano de saúde para a sua empresa");
    expect(text).toContain("Plano empresarial costuma ter um preço bem melhor que o individual.");
    expect(text).toContain("quantas pessoas entrariam no plano, contando sócios, funcionários e dependentes?");
  });

  it("still reads well without names (old callers pass only the lead name)", () => {
    expect(brokerGreeting("")).toMatch(/^Oi, tudo bem\? Acabei de receber/);
    expect(brokerGreeting("Wânia")).toMatch(/^Oi, Wânia, tudo bem\? Acabei/);
  });

  it("reads lives and city from the qualification", () => {
    expect(greetingFactsFromQualification({ qtdVidas: "2", cidade: "Rio de Janeiro" })).toEqual({ livesCount: 2, city: "Rio de Janeiro" });
    expect(greetingFactsFromQualification(null)).toEqual({ livesCount: null, city: null });
  });
});
