import { describe, expect, it } from "vitest";

import {
  classifyNextAction,
  isRepeatedReturn,
  RETORNO_MAX_DAYS_AHEAD,
  spCalendarDaysBetween,
  spDayKey,
  validateReturnDueAt,
} from "./proxima-acao-core";

// 11/11/2026 14:00 em São Paulo (UTC-3).
const now = new Date("2026-11-11T17:00:00.000Z");

describe("classifyNextAction", () => {
  it("sem tarefa aberta diz que não há retorno, sem prometer que está em dia", () => {
    const view = classifyNextAction(null, now);
    expect(view.state).toBe("none");
    expect(view.reason).not.toMatch(/em dia/i);
  });

  it("retorno de hoje antes da hora fica como hoje", () => {
    const view = classifyNextAction({ id: "t1", title: "Retorno", dueAt: new Date("2026-11-11T20:00:00.000Z") }, now);
    expect(view.state).toBe("today");
    expect(view.reason).toBe("Retorno hoje.");
  });

  it("retorno de ontem fica atrasado com os dias corridos de São Paulo", () => {
    const view = classifyNextAction({ id: "t1", title: "Retorno", dueAt: new Date("2026-11-10T15:00:00.000Z") }, now);
    expect(view.state).toBe("overdue");
    expect(view.reason).toBe("Retorno atrasado há 1 dia.");
  });

  it("retorno de hoje já passado da hora fica atrasado, não 'hoje'", () => {
    const view = classifyNextAction({ id: "t1", title: "Retorno", dueAt: new Date("2026-11-11T13:00:00.000Z") }, now);
    expect(view.state).toBe("overdue");
    expect(view.reason).toBe("Retorno atrasado de hoje.");
  });

  it("retorno futuro mostra os dias", () => {
    const view = classifyNextAction({ id: "t1", title: "Retorno", dueAt: new Date("2026-11-14T15:00:00.000Z") }, now);
    expect(view.state).toBe("upcoming");
    expect(view.reason).toBe("Retorno em 3 dias.");
  });

  it("tarefa sem prazo fica como próxima ação sem data", () => {
    const view = classifyNextAction({ id: "t1", title: "Retorno", dueAt: null }, now);
    expect(view.state).toBe("upcoming");
    expect(view.dueAt).toBeNull();
  });
});

describe("validateReturnDueAt", () => {
  it("aceita um horário futuro dentro da janela", () => {
    const result = validateReturnDueAt("2026-11-12T10:30", now);
    expect(result.ok).toBe(true);
  });

  it("recusa prazo vazio, inválido e no passado", () => {
    expect(validateReturnDueAt("", now).ok).toBe(false);
    expect(validateReturnDueAt("não é data", now).ok).toBe(false);
    expect(validateReturnDueAt(new Date(now.getTime() - 60_000).toISOString(), now).ok).toBe(false);
  });

  it("recusa prazo além da janela máxima", () => {
    const far = new Date(now.getTime() + (RETORNO_MAX_DAYS_AHEAD + 1) * 86_400_000).toISOString();
    expect(validateReturnDueAt(far, now).ok).toBe(false);
  });
});

describe("isRepeatedReturn", () => {
  const dueAt = new Date("2026-11-12T13:00:00.000Z");
  const base = { title: "Retorno", dueAt, createdAt: new Date(now.getTime() - 30_000), createdBy: "broker-1", completedAt: null };

  it("repetição idêntica dentro da janela não cria outra", () => {
    expect(isRepeatedReturn(base, { title: "Retorno", dueAt, userId: "broker-1" }, now)).toBe(true);
  });

  it("outro usuário, outro prazo, tarefa concluída ou fora da janela criam normalmente", () => {
    expect(isRepeatedReturn(base, { title: "Retorno", dueAt, userId: "broker-2" }, now)).toBe(false);
    expect(isRepeatedReturn(base, { title: "Retorno", dueAt: new Date("2026-11-13T13:00:00.000Z"), userId: "broker-1" }, now)).toBe(false);
    expect(isRepeatedReturn({ ...base, completedAt: now }, { title: "Retorno", dueAt, userId: "broker-1" }, now)).toBe(false);
    expect(isRepeatedReturn({ ...base, createdAt: new Date(now.getTime() - 10 * 60_000) }, { title: "Retorno", dueAt, userId: "broker-1" }, now)).toBe(false);
  });
});

describe("dias civis de São Paulo", () => {
  it("usa o dia de São Paulo, não o UTC", () => {
    expect(spDayKey(new Date("2026-11-12T01:00:00.000Z"))).toBe("2026-11-11");
    expect(spCalendarDaysBetween(new Date("2026-11-11T12:00:00.000Z"), new Date("2026-11-14T12:00:00.000Z"))).toBe(3);
  });
});
