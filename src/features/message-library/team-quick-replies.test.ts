import { describe, expect, it } from "vitest";

import {
  buildStoredVariables,
  DEFAULT_TEAM_QUICK_REPLIES,
  fillTeamQuickReply,
  filterTeamQuickReplies,
  normalizeShortcut,
  shortcutFromVariables,
  slashQuery,
  textVariablesFromStored,
  usableLeadName,
} from "./team-quick-replies";

describe("atalho", () => {
  it("normaliza para minúsculo, sem acento, sem barra e sem espaço", () => {
    expect(normalizeShortcut(" /Carência ")).toBe("carencia");
    expect(normalizeShortcut("pedir docs")).toBe("pedir_docs");
    expect(normalizeShortcut("R$!")).toBe("r");
    expect(normalizeShortcut("   ")).toBeNull();
    expect(normalizeShortcut(null)).toBeNull();
  });

  it("guarda o atalho no campo variables sem misturar com as variáveis do texto", () => {
    const stored = buildStoredVariables("Oi {{primeiro_nome}}, {{nome}}", "Carência");
    expect(stored).toEqual(["primeiro_nome", "nome", "atalho:carencia"]);
    expect(shortcutFromVariables(stored)).toBe("carencia");
    expect(textVariablesFromStored(stored)).toEqual(["primeiro_nome", "nome"]);
    expect(buildStoredVariables("Sem variável", null)).toEqual([]);
    expect(shortcutFromVariables(["nome"])).toBeNull();
    expect(shortcutFromVariables("x")).toBeNull();
  });
});

describe("busca com /", () => {
  it("só abre com a barra no começo do campo e sem espaço depois", () => {
    expect(slashQuery("/")).toBe("");
    expect(slashQuery("/car")).toBe("car");
    expect(slashQuery("")).toBeNull();
    expect(slashQuery("oi /car")).toBeNull();
    expect(slashQuery("/car ")).toBeNull();
    expect(slashQuery("/car\n")).toBeNull();
  });

  it("deixa /contato para o atalho de avisar quem vai ligar", () => {
    expect(slashQuery("/contato")).toBeNull();
    expect(slashQuery("/conta")).toBe("conta");
  });

  it("filtra por atalho primeiro, depois por título, sem acento", () => {
    const items = [
      { id: "1", title: "Cotação pronta", shortcut: "cotacao" },
      { id: "2", title: "Ligação sobre carência", shortcut: "carencia" },
      { id: "3", title: "Carteirinha", shortcut: null },
      { id: "4", title: "Pedir documentos", shortcut: "docs" },
    ];
    expect(filterTeamQuickReplies(items, "").map((item) => item.id)).toEqual(["1", "2", "3", "4"]);
    expect(filterTeamQuickReplies(items, "car").map((item) => item.id)).toEqual(["2", "3"]);
    expect(filterTeamQuickReplies(items, "CARÊN").map((item) => item.id)).toEqual(["2"]);
    expect(filterTeamQuickReplies(items, "pront").map((item) => item.id)).toEqual(["1"]);
    expect(filterTeamQuickReplies(items, "xyz")).toEqual([]);
    expect(filterTeamQuickReplies(items, "", 2)).toHaveLength(2);
  });
});

describe("nome do lead", () => {
  it("troca {{nome}} e {{primeiro_nome}}", () => {
    expect(fillTeamQuickReply("Olá, {{primeiro_nome}}! Confirmo para {{nome}}.", "Maria Souza")).toBe("Olá, Maria! Confirmo para Maria Souza.");
  });

  it("arruma nome todo em maiúsculas", () => {
    expect(usableLeadName("MARIA DA SILVA")).toBe("Maria da Silva");
    expect(fillTeamQuickReply("Oi {{primeiro_nome}}", "  joão  pedro ")).toBe("Oi João");
  });

  it("sem nome, nunca deixa a variável crua", () => {
    expect(fillTeamQuickReply("Olá, {{primeiro_nome}}! Tudo bem?", null)).toBe("Olá! Tudo bem?");
    expect(fillTeamQuickReply("{{primeiro_nome}}, sua cotação está pronta.", "")).toBe("Sua cotação está pronta.");
    expect(fillTeamQuickReply("Tudo certo. {{nome}}, posso ligar?", "5521999999999")).toBe("Tudo certo. Posso ligar?");
    expect(fillTeamQuickReply("Oi {{primeiro_nome}} tudo bem", "Cliente")).toBe("Oi tudo bem");
    expect(fillTeamQuickReply("Valor para {{resumo}}.", "Ana")).toBe("Valor para.");
  });

  it("as sugestões iniciais ficam limpas com e sem nome", () => {
    for (const reply of DEFAULT_TEAM_QUICK_REPLIES) {
      expect(fillTeamQuickReply(reply.text, "Ana Lima")).not.toMatch(/\{\{|—/);
      const neutral = fillTeamQuickReply(reply.text, null);
      expect(neutral).not.toMatch(/\{\{|^[,\s]|\s,/);
      expect(neutral.charAt(0)).toBe(neutral.charAt(0).toUpperCase());
    }
  });
});
