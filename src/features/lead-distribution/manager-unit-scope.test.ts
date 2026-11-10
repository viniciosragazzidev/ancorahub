import { describe, expect, it } from "vitest";

import { isScheduleExclusiveToUnit, isTypeUsableByUnit } from "./manager-unit-scope";
import { queueModeProblem } from "./queue-mode";

const UNIT = "unidade-centro";
const OTHER = "unidade-norte";

describe("plantão exclusivo da unidade do gestor", () => {
  it("aceita plantão gravado na unidade, com filas só da unidade", () => {
    expect(isScheduleExclusiveToUnit({ branchId: UNIT, typeBranchIds: [], queueBranchIds: [] }, UNIT)).toBe(true);
    expect(isScheduleExclusiveToUnit({ branchId: UNIT, typeBranchIds: [OTHER, UNIT], queueBranchIds: [UNIT, UNIT] }, UNIT)).toBe(true);
  });

  it("aceita plantão da empresa cujo tipo foi marcado só para a unidade", () => {
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [UNIT], queueBranchIds: [UNIT] }, UNIT)).toBe(true);
  });

  it("aceita plantão da empresa, de tipo de todas as unidades, que só alimenta filas da unidade (Plantão 7° Andar)", () => {
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [], queueBranchIds: [UNIT] }, UNIT)).toBe(true);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: null, queueBranchIds: [UNIT, UNIT] }, UNIT)).toBe(true);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [], queueBranchIds: [UNIT, null] }, UNIT)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [], queueBranchIds: [OTHER] }, UNIT)).toBe(false);
  });

  it("recusa plantão da empresa toda ou de tipo com mais de uma unidade", () => {
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [], queueBranchIds: [] }, UNIT)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: null, queueBranchIds: [] }, UNIT)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [UNIT, OTHER], queueBranchIds: [UNIT] }, UNIT)).toBe(false);
  });

  it("recusa plantão de outra unidade", () => {
    expect(isScheduleExclusiveToUnit({ branchId: OTHER, typeBranchIds: [], queueBranchIds: [] }, UNIT)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [OTHER], queueBranchIds: [] }, UNIT)).toBe(false);
  });

  it("recusa plantão que alimenta fila global ou de outra unidade", () => {
    expect(isScheduleExclusiveToUnit({ branchId: UNIT, typeBranchIds: [], queueBranchIds: [UNIT, OTHER] }, UNIT)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: UNIT, typeBranchIds: [], queueBranchIds: [null] }, UNIT)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: null, typeBranchIds: [UNIT], queueBranchIds: [OTHER] }, UNIT)).toBe(false);
  });

  it("gestor sem unidade não vê plantão nenhum", () => {
    expect(isScheduleExclusiveToUnit({ branchId: UNIT, typeBranchIds: [], queueBranchIds: [] }, null)).toBe(false);
    expect(isScheduleExclusiveToUnit({ branchId: UNIT, typeBranchIds: [], queueBranchIds: [] }, undefined)).toBe(false);
  });

  it("tipo vale para a unidade quando é de todas ou inclui a unidade", () => {
    expect(isTypeUsableByUnit([], UNIT)).toBe(true);
    expect(isTypeUsableByUnit([OTHER, UNIT], UNIT)).toBe(true);
    expect(isTypeUsableByUnit([OTHER], UNIT)).toBe(false);
  });
});

describe("modo da fila (automática ou manual)", () => {
  const unitQueue = { branchId: UNIT, status: "active" };

  it("gestor não troca o modo de nenhuma fila desde 10/11 (distribuição só do diretor)", () => {
    expect(queueModeProblem({ role: "manager", actorBranchId: UNIT, queue: unitQueue })).toMatch(/diretor/);
    expect(queueModeProblem({ role: "manager", actorBranchId: null, queue: unitQueue })).toMatch(/diretor/);
    expect(queueModeProblem({ role: "manager", actorBranchId: UNIT, queue: null })).toMatch(/diretor/);
  });

  it("diretor troca qualquer fila; os demais papéis não", () => {
    expect(queueModeProblem({ role: "director", actorBranchId: null, queue: { branchId: OTHER, status: "active" } })).toBeNull();
    expect(queueModeProblem({ role: "supervisor", actorBranchId: UNIT, queue: unitQueue })).toMatch(/Sem permissão/);
    expect(queueModeProblem({ role: "broker", actorBranchId: UNIT, queue: unitQueue })).toMatch(/Sem permissão/);
    expect(queueModeProblem({ role: "director", actorBranchId: null, queue: null })).toMatch(/não encontrada/);
  });
});
