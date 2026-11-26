import { describe, expect, it } from "vitest";

import { describeActiveConversationFilters, isBrokerAcquisitionConversation, isUnownedConversation } from "./conversation-filters";

describe("filtros ativos da central de conversas", () => {
  it("sem nada ativo, lista vazia", () => {
    expect(describeActiveConversationFilters({ query: "   " })).toEqual([]);
  });

  it("descreve busca, unidade, tag e situação na ordem da tela", () => {
    expect(describeActiveConversationFilters({
      query: " Ana ",
      branchName: "Centro",
      tagName: "Quente",
      situationLabel: "Esperando resposta",
    })).toEqual(["Busca: Ana", "Unidade: Centro", "Tag: Quente", "Situação: Esperando resposta"]);
  });

  it("mostra só o que está ativo", () => {
    expect(describeActiveConversationFilters({ situationLabel: "Sem dono", branchName: null })).toEqual(["Situação: Sem dono"]);
  });

  it("sem dono é conversa sem corretor", () => {
    expect(isUnownedConversation({ corretorId: null })).toBe(true);
    expect(isUnownedConversation({ corretorId: "u1" })).toBe(false);
  });
});

describe("isBrokerAcquisitionConversation", () => {
  it("recognizes the Aquisição Corretores queue by name, with or without accents", () => {
    expect(isBrokerAcquisitionConversation({ queueName: "Aquisição Corretores" })).toBe(true);
    expect(isBrokerAcquisitionConversation({ queueName: "aquisicao  corretores" })).toBe(true);
    expect(isBrokerAcquisitionConversation({ queueName: "FILA PF - RENAN" })).toBe(false);
    expect(isBrokerAcquisitionConversation({ queueName: null })).toBe(false);
  });
});
