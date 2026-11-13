import { describe, expect, it } from "vitest";

import { factsFromQualification, plausibleCity } from "./facts";
import { openingMessages } from "./quote-messages";
import { buildTurnContext, cleanModelFacts, plainLanguage, QUESTION_FOR } from "./turn-engine";

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

  it("a assistente lê a conversa da qualificação e o que ela mesma enviou", () => {
    const context = JSON.parse(buildTurnContext({
      facts: {}, stage: "confirming", offers: [], promotions: [],
      history: [{ direction: "out", body: "Vi que você procura um plano de saúde. Posso te ajudar a escolher?" }],
      qualificationHistory: [{ direction: "out", body: "Qual a idade de cada pessoa?" }, { direction: "in", body: "34 anos, só para mim" }],
      inbound: ["Sim"],
    })) as { conversaDaQualificacao: string[]; historico: string[] };
    expect(context.conversaDaQualificacao).toEqual(["Qualificação: Qual a idade de cada pessoa?", "Cliente: 34 anos, só para mim"]);
    expect(context.historico[0]).toMatch(/^Você: Vi que você procura/);
  });

  it("sem PME, adesão ou pessoa física com o cliente", () => {
    expect(plainLanguage("E qual modalidade você está buscando: pessoa física, adesão ou PME?")).toBe(QUESTION_FOR.modality);
    expect(plainLanguage("Para PME tem opções boas.")).toBe("Para plano pela empresa tem opções boas.");
    expect(plainLanguage("Qual a sua idade?")).toBe("Qual a sua idade?");
    for (const question of Object.values(QUESTION_FOR)) expect(question).not.toMatch(/\bPME\b|ades[aã]o|pessoa f[ií]sica|modalidade|\bEPP\b|\bLTDA\b/i);
  });

  it("a frase da abertura fica certa com ou sem idades e cidade", () => {
    const brokerageName = "Âncora Saúde";
    expect(openingMessages({ brokerageName, facts: { firstName: "Alex", city: "Niterói" } })[1]).toBe("Vi que você procura um plano de saúde em Niterói. Está certo?");
    expect(openingMessages({ brokerageName, facts: { ages: [30] } })[1]).toMatch(/^Vi que você procura um plano de saúde para .+\. Está certo\?$/);
    expect(openingMessages({ brokerageName, facts: { hasCnpj: true }, livesCount: 2 })[1]).toBe("Vi que você procura um plano de saúde para 2 pessoas, pela sua empresa. Está certo?");
    expect(openingMessages({ brokerageName, facts: {} })[1]).toBe("Vi que você procura um plano de saúde. Posso te ajudar a escolher?");
  });
});

describe("responder na hora (caso Katia, 13/11)", () => {
  it("cliente que acabou de escrever recebe resposta mesmo fora do horário de envio", async () => {
    const { canSpeakNow, customerJustWrote } = await import("./guardrails");
    const { DEFAULT_AUTO_SALE_SETTINGS } = await import("./settings");
    const early = new Date("2026-11-13T09:50:00.000Z"); // 06:50 em São Paulo
    expect(canSpeakNow(early, DEFAULT_AUTO_SALE_SETTINGS, null)).toBe(false);
    expect(canSpeakNow(early, DEFAULT_AUTO_SALE_SETTINGS, new Date(early.getTime() - 60_000))).toBe(true);
    expect(customerJustWrote(new Date(early.getTime() - 2 * 3_600_000), early)).toBe(false);
  });
});
