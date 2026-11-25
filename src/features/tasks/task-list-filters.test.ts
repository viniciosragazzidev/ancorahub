import { describe, expect, it } from "vitest";

import { normalizeTaskListFilters } from "./task-list-filters";

describe("normalizeTaskListFilters", () => {
  it("o corretor fica sempre em Minhas, mesmo pedindo a equipe, e sem filtro de responsável", () => {
    expect(normalizeTaskListFilters("broker", { escopo: "equipe", responsavel: "u2" })).toEqual({ scope: "minhas", situation: "abertas", assigneeId: null, page: 1 });
  });

  it("diretor, gestor e supervisor começam em Da equipe e podem escolher Minhas", () => {
    for (const role of ["director", "manager", "supervisor"]) {
      expect(normalizeTaskListFilters(role, {}).scope).toBe("equipe");
      expect(normalizeTaskListFilters(role, { escopo: "minhas", responsavel: "u2" })).toMatchObject({ scope: "minhas", assigneeId: null });
    }
    expect(normalizeTaskListFilters("director", { responsavel: "u2" }).assigneeId).toBe("u2");
  });

  it("situação e página inválidas voltam ao padrão", () => {
    expect(normalizeTaskListFilters("director", { situacao: "concluidas", page: "3" })).toMatchObject({ situation: "concluidas", page: 3 });
    expect(normalizeTaskListFilters("director", { situacao: "x", page: "-2" })).toMatchObject({ situation: "abertas", page: 1 });
    expect(normalizeTaskListFilters("director", { page: "abc" }).page).toBe(1);
  });
});
