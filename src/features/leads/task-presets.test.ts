import { describe, expect, it } from "vitest";

import { applyTaskPreset, computeTaskPresetDue, TASK_PRESETS, taskLocalInputToIso, toTaskLocalInput } from "./task-presets";

const preset = (id: string) => {
  const found = TASK_PRESETS.find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("atalhos de tarefa", () => {
  it("lista os cinco atalhos da corretora com rótulo e título", () => {
    expect(TASK_PRESETS.map((item) => item.label)).toEqual([
      "Ligar amanhã 9h",
      "Cobrar documentos em 2 dias",
      "Retornar cotação em 3 dias",
      "Confirmar aprovação da operadora em 2 dias",
      "Confirmar carteirinha em 15 dias",
    ]);
    for (const item of TASK_PRESETS) {
      expect(item.title.length).toBeGreaterThanOrEqual(3);
      expect(item.label).not.toContain("—");
    }
  });

  it("ligar amanhã 9h é 9h de São Paulo (12h UTC)", () => {
    // Terça, 24/11/2026 15:00 em São Paulo.
    const due = computeTaskPresetDue(preset("ligar-amanha"), new Date("2026-11-24T18:00:00Z"));
    expect(due.toISOString()).toBe("2026-11-25T12:00:00.000Z");
  });

  it("usa o dia de São Paulo, não o de UTC, perto da meia-noite", () => {
    // Terça 24/11 às 22:30 em São Paulo já é quarta 25/11 em UTC.
    const due = computeTaskPresetDue(preset("ligar-amanha"), new Date("2026-11-25T01:30:00Z"));
    expect(toTaskLocalInput(due)).toBe("2026-11-25T09:00");
  });

  it("amanhã no domingo pula para segunda 9h", () => {
    // Sábado, 28/11/2026 10:00 em São Paulo.
    const due = computeTaskPresetDue(preset("ligar-amanha"), new Date("2026-11-28T13:00:00Z"));
    expect(toTaskLocalInput(due)).toBe("2026-11-30T09:00");
  });

  it("prazo em dias que cai no domingo vai para segunda, na mesma hora", () => {
    // Sexta, 27/11/2026 14:20 em São Paulo + 2 dias = domingo 29/11, vira segunda 30/11.
    const due = computeTaskPresetDue(preset("cobrar-documentos"), new Date("2026-11-27T17:20:00Z"));
    expect(toTaskLocalInput(due)).toBe("2026-11-30T14:20");
  });

  it("vira o mês", () => {
    // Domingo, 29/11/2026 11:00 + 3 dias = quarta, 02/12.
    expect(toTaskLocalInput(computeTaskPresetDue(preset("retornar-cotacao"), new Date("2026-11-29T14:00:00Z")))).toBe("2026-12-02T11:00");
    // Segunda, 30/11 + 1 dia às 9h = terça, 01/12.
    expect(toTaskLocalInput(computeTaskPresetDue(preset("ligar-amanha"), new Date("2026-11-30T20:00:00Z")))).toBe("2026-12-01T09:00");
  });

  it("vira o ano e respeita 15 dias da carteirinha", () => {
    // Quinta, 24/12/2026 10:00 + 15 dias = sexta, 08/01/2027.
    expect(toTaskLocalInput(computeTaskPresetDue(preset("confirmar-carteirinha"), new Date("2026-12-24T13:00:00Z")))).toBe("2027-01-08T10:00");
  });

  it("aplicar preenche título e o valor do campo de prazo", () => {
    expect(applyTaskPreset(preset("confirmar-aprovacao"), new Date("2026-11-24T18:00:00Z"))).toEqual({
      title: "Confirmar aprovação da operadora",
      dueAt: "2026-11-26T15:00",
    });
  });

  it("converte o campo datetime-local como hora de São Paulo", () => {
    expect(taskLocalInputToIso("2026-11-25T09:00")).toBe("2026-11-25T12:00:00.000Z");
    expect(taskLocalInputToIso("")).toBeNull();
    expect(taskLocalInputToIso("amanhã")).toBeNull();
    expect(toTaskLocalInput(new Date("2026-11-25T12:00:00Z"))).toBe("2026-11-25T09:00");
  });
});
