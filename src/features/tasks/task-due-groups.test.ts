import { describe, expect, it } from "vitest";

import { canSeeTeamTasks, formatTaskDue, groupTasksByDue, isTaskOverdue, taskDueGroupOf } from "./task-due-groups";

// Quarta-feira, 25/11/2026, 14:00 em São Paulo (UTC-3).
const now = new Date("2026-11-25T17:00:00Z");

describe("taskDueGroupOf (fuso America/Sao_Paulo)", () => {
  it("prazo que já passou é atrasada, mesmo hoje mais cedo", () => {
    expect(taskDueGroupOf("2026-11-25T12:00:00Z", now)).toBe("atrasadas");
    expect(taskDueGroupOf("2026-11-20T12:00:00Z", now)).toBe("atrasadas");
  });

  it("hoje vai até 23:59 de São Paulo, não até a meia-noite UTC", () => {
    expect(taskDueGroupOf("2026-11-25T20:00:00Z", now)).toBe("hoje");
    expect(taskDueGroupOf("2026-11-26T02:30:00Z", now)).toBe("hoje");
    expect(taskDueGroupOf("2026-11-26T03:30:00Z", now)).toBe("amanha");
  });

  it("depois de amanhã até domingo é esta semana; segunda já é mais tarde", () => {
    expect(taskDueGroupOf("2026-11-27T12:00:00Z", now)).toBe("esta_semana");
    expect(taskDueGroupOf("2026-11-30T02:59:00Z", now)).toBe("esta_semana");
    expect(taskDueGroupOf("2026-11-30T03:00:00Z", now)).toBe("mais_tarde");
  });

  it("no domingo, a semana acaba no próprio dia", () => {
    const sunday = new Date("2026-11-29T15:00:00Z");
    expect(taskDueGroupOf("2026-11-30T12:00:00Z", sunday)).toBe("amanha");
    expect(taskDueGroupOf("2026-12-01T12:00:00Z", sunday)).toBe("mais_tarde");
  });

  it("sem prazo ou data inválida fica em Sem prazo", () => {
    expect(taskDueGroupOf(null, now)).toBe("sem_prazo");
    expect(taskDueGroupOf("não é data", now)).toBe("sem_prazo");
  });
});

describe("groupTasksByDue", () => {
  it("devolve só os grupos com linhas, na ordem de leitura e do prazo mais antigo ao mais novo", () => {
    const groups = groupTasksByDue([
      { id: "c", dueAt: null },
      { id: "b", dueAt: "2026-11-25T20:00:00Z" },
      { id: "a2", dueAt: "2026-11-24T12:00:00Z" },
      { id: "a1", dueAt: "2026-11-20T12:00:00Z" },
      { id: "d", dueAt: "2026-12-10T12:00:00Z" },
    ], now);
    expect(groups.map((group) => [group.label, group.rows.map((row) => row.id)])).toEqual([
      ["Atrasadas", ["a1", "a2"]],
      ["Hoje", ["b"]],
      ["Mais tarde", ["d"]],
      ["Sem prazo", ["c"]],
    ]);
  });
});

describe("formatTaskDue", () => {
  it("escreve o prazo curto conforme o dia", () => {
    expect(formatTaskDue("2026-11-25T20:00:00Z", now)).toBe("Hoje, 17:00");
    expect(formatTaskDue("2026-11-26T12:00:00Z", now)).toBe("Amanhã, 09:00");
    expect(formatTaskDue("2026-11-24T13:00:00Z", now)).toBe("Ontem, 10:00");
    expect(formatTaskDue("2026-11-27T12:00:00Z", now)).toBe("sex, 09:00");
    expect(formatTaskDue("2026-11-20T12:00:00Z", now)).toBe("20/11, 09:00");
    expect(formatTaskDue("2027-01-05T12:00:00Z", now)).toBe("05/01/2027, 09:00");
    expect(formatTaskDue(null, now)).toBe("Sem prazo");
  });

  it("isTaskOverdue segue a mesma regra do grupo", () => {
    expect(isTaskOverdue("2026-11-25T16:59:00Z", now)).toBe(true);
    expect(isTaskOverdue("2026-11-25T17:01:00Z", now)).toBe(false);
    expect(isTaskOverdue(null, now)).toBe(false);
  });
});

describe("canSeeTeamTasks", () => {
  it("só diretor, gestor e supervisor veem Da equipe", () => {
    expect(["director", "manager", "supervisor"].every(canSeeTeamTasks)).toBe(true);
    expect(canSeeTeamTasks("broker")).toBe(false);
  });
});
