import { describe, expect, it } from "vitest";

import { createEmptyMemory } from "@/features/ai-agent/memory";
import { shouldVerifyExtraction } from "@/features/ai-agent/qualification-interpreter";
import { withBrokerReturnPhrase } from "./broker-window";
import { AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, isAfterHoursInSaoPaulo, renderConversationVariables } from "./reply-composer";

/** São Paulo is UTC-3. */
const sp = (hour: number, minute = 0) => new Date(Date.UTC(2026, 9, 21, hour + 3, minute));

describe("encerramento fora do horário (19h às 9h)", () => {
  it("é noite das 19h às 8h59 em São Paulo", () => {
    expect(isAfterHoursInSaoPaulo(sp(18, 59))).toBe(false);
    expect(isAfterHoursInSaoPaulo(sp(19))).toBe(true);
    expect(isAfterHoursInSaoPaulo(sp(23, 30))).toBe(true);
    expect(isAfterHoursInSaoPaulo(new Date(Date.UTC(2026, 9, 22, 11, 59)))).toBe(true); // 8h59
    expect(isAfterHoursInSaoPaulo(new Date(Date.UTC(2026, 9, 22, 12, 0)))).toBe(false); // 9h
  });

  it("diz quando o corretor volta, sem prometer instantes à noite", () => {
    const text = renderConversationVariables(withBrokerReturnPhrase(AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, sp(20)), createEmptyMemory(), "Edivaldo Souza");
    expect(text).toContain("Um corretor fala com você por aqui amanhã, a partir das 9h.");
    expect(text).not.toMatch(/instantes|agora|\{\{/);
  });

  it("não deixa a frase de retorno sem preencher", () => {
    const text = renderConversationVariables(withBrokerReturnPhrase(AFTER_HOURS_QUALIFIED_HANDOFF_TEXT, sp(10)), createEmptyMemory(), "Edivaldo Souza");
    expect(text).toContain("por aqui em instantes.");
  });
});

describe("quando a IA confere o resumo", () => {
  it("confere mensagens longas ou com vários números; confia em respostas curtas", () => {
    expect(shouldVerifyExtraction("Tenho 63 anos meu nome é Edivaldo tenho 63 anos")).toBe(true);
    expect(shouldVerifyExtraction("35 e 32")).toBe(true);
    expect(shouldVerifyExtraction("35")).toBe(false);
    expect(shouldVerifyExtraction("família")).toBe(false);
  });
});
