import { describe, expect, it } from "vitest";

import { kanbanColumnSummary } from "./kanban-column-summary";

const normalize = (text: string | null) => text?.replace(/\s/g, " ") ?? null;

describe("resumo da coluna do kanban", () => {
  it("soma valor e vidas da etapa", () => {
    expect(normalize(kanbanColumnSummary([{ monthlyValue: "1234.56", livesCount: 2 }, { monthlyValue: 100, livesCount: 1 }], { showValue: true }))).toBe("R$ 1.334,56 · 3 vidas");
  });

  it("só o que houver", () => {
    expect(kanbanColumnSummary([{ livesCount: 1 }], { showValue: true })).toBe("1 vida");
    expect(normalize(kanbanColumnSummary([{ monthlyValue: "50" }], { showValue: true }))).toBe("R$ 50,00");
    expect(kanbanColumnSummary([], { showValue: true })).toBeNull();
  });

  it("sem valores comerciais ligados, só as vidas", () => {
    expect(kanbanColumnSummary([{ monthlyValue: "999", livesCount: 4 }], { showValue: false })).toBe("4 vidas");
    expect(kanbanColumnSummary([{ monthlyValue: "999" }], { showValue: false })).toBeNull();
  });
});
