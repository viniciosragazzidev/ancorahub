import { describe, expect, it } from "vitest";
import { parseCreateDutyScheduleInput } from "./duty-schedule-input";

const firstBranchId = "11111111-1111-4111-8111-111111111111";
const secondBranchId = "22222222-2222-4222-8222-222222222222";
const firstQueueId = "33333333-3333-4333-8333-333333333333";
const secondQueueId = "44444444-4444-4444-8444-444444444444";

function validFormData(unitAssignments: Array<{ branchId: string; queueId: string }>) {
  const formData = new FormData();
  formData.set("name", "Plantão comercial");
  formData.set("daysOfWeek", JSON.stringify([1]));
  formData.set("startsAt", "09:00");
  formData.set("endsAt", "18:00");
  formData.set("priority", "100");
  formData.set("minimumBrokers", "1");
  formData.set("validFrom", "2026-07-28");
  formData.set("unitAssignments", JSON.stringify(unitAssignments));
  return formData;
}

describe("parseCreateDutyScheduleInput", () => {
  it("aceita um lote com regras independentes por unidade", () => {
    const parsed = parseCreateDutyScheduleInput(validFormData([
      { branchId: firstBranchId, queueId: firstQueueId },
      { branchId: secondBranchId, queueId: secondQueueId },
    ]));

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.unitAssignments).toHaveLength(2);
      expect(parsed.data.daysOfWeek).toEqual([1]);
    }
  });

  it("aceita vários dias da semana para cada unidade", () => {
    const formData = validFormData([{ branchId: firstBranchId, queueId: firstQueueId }]);
    formData.set("daysOfWeek", JSON.stringify([1, 3, 5]));

    const parsed = parseCreateDutyScheduleInput(formData);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.daysOfWeek).toEqual([1, 3, 5]);
  });

  it("mantém compatibilidade com o campo legado de um único dia", () => {
    const formData = validFormData([{ branchId: firstBranchId, queueId: firstQueueId }]);
    formData.delete("daysOfWeek");
    formData.set("dayOfWeek", "2");

    const parsed = parseCreateDutyScheduleInput(formData);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.daysOfWeek).toEqual([2]);
  });

  it("recusa dias repetidos", () => {
    const formData = validFormData([{ branchId: firstBranchId, queueId: firstQueueId }]);
    formData.set("daysOfWeek", JSON.stringify([1, 1]));

    const parsed = parseCreateDutyScheduleInput(formData);

    expect(parsed.success).toBe(false);
  });

  it("recusa a mesma unidade duas vezes no mesmo lote", () => {
    const parsed = parseCreateDutyScheduleInput(validFormData([
      { branchId: firstBranchId, queueId: firstQueueId },
      { branchId: firstBranchId, queueId: secondQueueId },
    ]));

    expect(parsed.success).toBe(false);
  });

  it("aceita a fila responsável opcional, usada só para liberar horários sobrepostos em filas diferentes", () => {
    const formData = validFormData([{ branchId: firstBranchId, queueId: firstQueueId }]);
    formData.set("responsibleQueueId", secondQueueId);

    const parsed = parseCreateDutyScheduleInput(formData);

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.responsibleQueueId).toBe(secondQueueId);
  });

  it("trata a fila responsável ausente como null, sem bloquear a criação", () => {
    const parsed = parseCreateDutyScheduleInput(validFormData([{ branchId: firstBranchId, queueId: firstQueueId }]));

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.responsibleQueueId).toBeNull();
  });
});
