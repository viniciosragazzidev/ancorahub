import { describe, expect, it } from "vitest";
import { parseCreateDutyScheduleInput } from "./duty-schedule-input";

const firstBranchId = "11111111-1111-4111-8111-111111111111";
const secondBranchId = "22222222-2222-4222-8222-222222222222";
const firstQueueId = "33333333-3333-4333-8333-333333333333";
const secondQueueId = "44444444-4444-4444-8444-444444444444";

function validFormData(unitAssignments: Array<{ branchId: string; queueId: string }>) {
  const formData = new FormData();
  formData.set("name", "Plantão comercial");
  formData.set("dayOfWeek", "1");
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
    if (parsed.success) expect(parsed.data.unitAssignments).toHaveLength(2);
  });

  it("recusa a mesma unidade duas vezes no mesmo lote", () => {
    const parsed = parseCreateDutyScheduleInput(validFormData([
      { branchId: firstBranchId, queueId: firstQueueId },
      { branchId: firstBranchId, queueId: secondQueueId },
    ]));

    expect(parsed.success).toBe(false);
  });
});
