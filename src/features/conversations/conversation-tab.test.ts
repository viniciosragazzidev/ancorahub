import { describe, expect, it } from "vitest";
import { resolveConversationTab } from "./conversation-tab";

describe("resolveConversationTab", () => {
  it("habilita Distribuidos somente para papeis que ja veem as abas de gestao", () => {
    expect(resolveConversationTab("distribuidos", true, false)).toBe("distribuidos");
    expect(resolveConversationTab("distribuidos", false, false)).toBe("leads");
  });

  it("mantem abas existentes e ignora coexistencia quando nao ha canal ativo", () => {
    expect(resolveConversationTab("corretores", true, false)).toBe("corretores");
    expect(resolveConversationTab("coex", true, false)).toBe("leads");
    expect(resolveConversationTab("coex", true, true)).toBe("coex");
    expect(resolveConversationTab(undefined, true, true)).toBe("leads");
  });
});
