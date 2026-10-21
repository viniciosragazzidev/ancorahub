import { describe, expect, it } from "vitest";

import { isAutomatedInboundMessage } from "./automated-inbound";
import { composeGreeting, greetingName } from "@/features/qualification-engine/reply-composer";

describe("automated inbound messages", () => {
  it.each([
    "Digite sua idade por favor.", // case Neuza: not her answer
    "Digite sua idade e receba uma cotação personalizada do Plano Assim 31", // click-to-WhatsApp ad text
    "Olá! Obrigado por entrar em contato. Em breve retornaremos.",
    "Esta é uma mensagem automática. No momento não podemos atender.",
    "Estamos fora do horário de atendimento.",
    "Escolha uma opção:\n1 - Vendas\n2 - Financeiro",
    "Olá, como posso ajudar?",
  ])("detects %j", (message) => {
    expect(isAutomatedInboundMessage(message)).toBe(true);
  });

  it.each([
    "Pode ser 1", "Familiar", "Quero um plano para mim e minha esposa", "Quanto custa?",
    "Tenho 42 anos", "Neuza Maria da Silva", "Oi, vi o anúncio e queria uma cotação",
    "Obrigado pelo contato, tenho 4 vidas", "Se for o caso digite 3 aí que eu vejo depois",
  ])("keeps %j as the person's answer", (message) => {
    expect(isAutomatedInboundMessage(message)).toBe(false);
  });
});

describe("greeting on the first reply", () => {
  it("greets by name and says who is talking and from which company", () => {
    const greeting = composeGreeting({ name: "NEUZA maria", assistantName: "Ana", companyName: "Âncora Saúde", seed: "conv-1" });
    expect(greeting).toMatch(/^(Oi|Olá), Neuza/);
    expect(greeting).toContain("Me chamo Ana e falo da Âncora Saúde");
  });

  it("does not use a placeholder lead name or a generic assistant label as a person", () => {
    const greeting = composeGreeting({ name: "Lead WhatsApp 5521999", assistantName: "Assistente Âncora Corretora", companyName: "Âncora Saúde", seed: "conv-2" });
    expect(greeting).toMatch(/^(Oi!|Olá, tudo bem\?|Oi, tudo bem\?) Aqui é da Âncora Saúde\./);
    expect(greetingName("Cliente")).toBeNull();
  });

  it("varies the wording across conversations", () => {
    const texts = new Set(Array.from({ length: 12 }, (_, index) => composeGreeting({ name: "Neuza", assistantName: "Ana", seed: `conv-${index}` })));
    expect(texts.size).toBeGreaterThan(2);
  });
});
