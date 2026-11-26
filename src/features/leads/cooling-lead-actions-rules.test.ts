import { describe, expect, it } from "vitest";

import { buildNudgeTask, canRunCoolingActions, coolingActionsFor, coolingScopeAllows } from "./cooling-lead-actions-rules";

const DAY = 86_400_000;

describe("permissões das ações do radar Esfriando", () => {
  it("só diretor, gestor e supervisor agem; corretor e outros papéis não", () => {
    expect(canRunCoolingActions("director")).toBe(true);
    expect(canRunCoolingActions("manager")).toBe(true);
    expect(canRunCoolingActions("supervisor")).toBe(true);
    expect(canRunCoolingActions("broker")).toBe(false);
    expect(canRunCoolingActions("marketing")).toBe(false);
  });

  it("corretor não vê nenhuma ação, nem no lead dele", () => {
    expect(coolingActionsFor({ role: "broker", userId: "c1" }, { corretorId: "c1" })).toEqual([]);
    expect(coolingActionsFor({ role: "broker", userId: "c1" }, { corretorId: "c2" })).toEqual([]);
  });

  it("gestor vê as três; sem corretor não há quem cobrar; lead dele não tem Assumir nem cobrança", () => {
    expect(coolingActionsFor({ role: "manager", userId: "g1" }, { corretorId: "c1" })).toEqual(["assume", "nudge", "redistribute"]);
    expect(coolingActionsFor({ role: "manager", userId: "g1" }, { corretorId: null })).toEqual(["assume", "redistribute"]);
    expect(coolingActionsFor({ role: "director", userId: "d1" }, { corretorId: "d1" })).toEqual(["redistribute"]);
  });

  it("diretor age na empresa toda", () => {
    expect(coolingScopeAllows({ role: "director", userId: "d1", branchId: null }, { corretorId: "c1", branchId: "b9" })).toBe(true);
  });

  it("gestor só na própria unidade; sem unidade, em nenhuma", () => {
    expect(coolingScopeAllows({ role: "manager", userId: "g1", branchId: "b1" }, { corretorId: "c1", branchId: "b1" })).toBe(true);
    expect(coolingScopeAllows({ role: "manager", userId: "g1", branchId: "b1" }, { corretorId: "c1", branchId: "b2" })).toBe(false);
    expect(coolingScopeAllows({ role: "manager", userId: "g1", branchId: null }, { corretorId: "c1", branchId: null })).toBe(false);
  });

  it("supervisor só nos leads dos corretores da equipe; lead sem corretor fica fora", () => {
    const actor = { role: "supervisor", userId: "s1", branchId: "b1" };
    expect(coolingScopeAllows(actor, { corretorId: "c1", branchId: "b1" }, ["c1", "c2"])).toBe(true);
    expect(coolingScopeAllows(actor, { corretorId: "c3", branchId: "b1" }, ["c1", "c2"])).toBe(false);
    expect(coolingScopeAllows(actor, { corretorId: null, branchId: "b1" }, ["c1"])).toBe(false);
  });

  it("corretor nunca passa pelo escopo", () => {
    expect(coolingScopeAllows({ role: "broker", userId: "c1", branchId: "b1" }, { corretorId: "c1", branchId: "b1" }, ["c1"])).toBe(false);
  });
});

describe("tarefa de cobrança", () => {
  it("leva o nome do lead, há quanto tempo está parado e prazo de 2 horas", () => {
    const now = new Date("2026-11-26T12:00:00.000Z");
    const task = buildNudgeTask({ leadName: " Maria Souza ", idleMs: 4 * DAY + 3_600_000, actorRole: "manager", now });
    expect(task.title).toBe("Retomar contato com Maria Souza");
    expect(task.description).toBe("Lead parado há 4 dias. Pedido do gestor no radar Esfriando.");
    expect(task.dueAt).toBe("2026-11-26T14:00:00.000Z");
    expect(task.priority).toBe("normal");
    expect(`${task.title} ${task.description}`).not.toContain("—");
  });
});
