import { describe, expect, it } from "vitest";
import { leadsViewRequiresServerData } from "./leads-view-navigation";

describe("leads view navigation", () => {
  it("keeps local projections client-side", () => {
    expect(leadsViewRequiresServerData("list", null)).toBe(false);
    expect(leadsViewRequiresServerData("kanban", "list")).toBe(false);
    expect(leadsViewRequiresServerData("perdidos", "list")).toBe(false);
    expect(leadsViewRequiresServerData("qualificacoes", "list")).toBe(false);
  });

  it("reloads when entering or leaving the server-backed unassigned view", () => {
    expect(leadsViewRequiresServerData("sem-atribuicao", "list")).toBe(true);
    expect(leadsViewRequiresServerData("list", "sem-atribuicao")).toBe(true);
  });

  it("a visão Esfriando busca os leads parados no servidor", () => {
    expect(leadsViewRequiresServerData("esfriando", "kanban")).toBe(true);
    expect(leadsViewRequiresServerData("kanban", "esfriando")).toBe(true);
  });
});
