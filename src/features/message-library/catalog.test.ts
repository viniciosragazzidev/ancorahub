import { describe, expect, it } from "vitest";

import { acceptSuggestedVariations, channelValidity, describeUsages, MESSAGE_KIND_LABEL, QUICK_REPLY_SITUATIONS, textVariables } from "./catalog";

describe("AI suggested variations", () => {
  const original = "Claro, {{nome}}! Já passei seu atendimento para um corretor ({{resumo}}).";

  it("keeps only rewordings with exactly the same variables", () => {
    expect(acceptSuggestedVariations(original, [
      "1. Certo, {{nome}}! Um corretor já recebeu seu atendimento ({{resumo}}).",
      "Pronto! Um corretor vai continuar com você.",
      "Oi {{nome}}, {{empresa}} já passou para um corretor ({{resumo}}).",
      "- Perfeito, {{nome}}! Encaminhei para um corretor especialista ({{resumo}}).",
    ])).toEqual([
      "Certo, {{nome}}! Um corretor já recebeu seu atendimento ({{resumo}}).",
      "Perfeito, {{nome}}! Encaminhei para um corretor especialista ({{resumo}}).",
    ]);
  });

  it("refuses prices, percentages, waiting periods and promises the original did not have", () => {
    expect(acceptSuggestedVariations("Um corretor vai te mandar as opções.", [
      "Um corretor vai te mandar opções a partir de R$ 199,90.",
      "Um corretor manda as opções com 20% de desconto.",
      "Um corretor vai te mandar as opções, sem carência.",
      "Já já um corretor te manda as opções.",
    ])).toEqual(["Já já um corretor te manda as opções."]);
  });

  it("drops repeats, the original itself and keeps at most three", () => {
    const text = "Recebi sua mensagem.";
    expect(acceptSuggestedVariations(text, [text, "Mensagem recebida.", "mensagem recebida.", "Sua mensagem chegou.", "Recebido, obrigado.", "Tudo certo, recebi."])).toEqual(["Mensagem recebida.", "Sua mensagem chegou.", "Recebido, obrigado."]);
  });

  it("lists the variables of a text and the AI situations that can be edited", () => {
    expect(textVariables("Oi {{ nome }}, {{resumo}} e {{nome}}")).toEqual(["nome", "resumo"]);
    expect(QUICK_REPLY_SITUATIONS.map((item) => item.ruleKey)).toContain("human.requested");
    expect(QUICK_REPLY_SITUATIONS.map((item) => item.ruleKey)).not.toContain("greeting.initial");
  });
});

describe("message library catalog", () => {
  it("states where each kind of message is valid", () => {
    expect(channelValidity("meta_template").map((item) => [item.channel, item.valid])).toEqual([["meta", "always"], ["company_number", "never"]]);
    expect(channelValidity("free_message").map((item) => [item.channel, item.valid])).toEqual([["meta", "window"], ["company_number", "always"]]);
    expect(channelValidity("quick_reply").every((item) => item.valid === "window")).toBe(true);
  });

  it("names kinds and usages in plain words", () => {
    expect(MESSAGE_KIND_LABEL.free_message).toBe("Mensagem livre");
    expect(describeUsages([{ area: "team_notice", label: "Aviso da equipe: Lead atribuído" }, { area: "situation", label: "Situação: Primeiro contato" }])).toBe("Aviso da equipe: Lead atribuído · Situação: Primeiro contato");
  });
});
