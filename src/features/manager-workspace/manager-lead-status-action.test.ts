import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { role: "manager" as string, branchId: "unit-a" as string | null, leadRows: [] as { id: string }[] };
const changeLeadStatus = vi.fn(async (_input: unknown) => ({}));

vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ tenantId: "tenant-1", userId: "manager-1", role: state.role, branchId: state.branchId }),
}));
vi.mock("@/shared/db", () => ({
  getDatabase: () => ({ select: () => ({ from: () => ({ where: () => ({ limit: async () => state.leadRows }) }) }) }),
  schema: { leads: { id: "id", tenantId: "tenantId", branchId: "branchId", deletedAt: "deletedAt", archivedAt: "archivedAt" } },
}));
vi.mock("@/features/leads/change-lead-status", () => ({ changeLeadStatus: (input: unknown) => changeLeadStatus(input) }));

import { changeManagerLeadStatusAction } from "./manager-lead-status-action";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

beforeEach(() => {
  state.role = "manager";
  state.branchId = "unit-a";
  state.leadRows = [{ id: "lead-1" }];
  changeLeadStatus.mockClear();
});

describe("changeManagerLeadStatusAction (gestor Lite)", () => {
  it("moves a lead of the manager's unit through the existing status flow", async () => {
    const result = await changeManagerLeadStatusAction({}, form({ leadId: "lead-1", newStatus: "quote_sent" }));

    expect(result.success).toBe(true);
    expect(changeLeadStatus).toHaveBeenCalledWith({ leadId: "lead-1", newStatus: "quote_sent", motivoPerda: null, justificativaRegressao: null });
  });

  it("refuses anyone who is not a manager with a unit, without touching the lead", async () => {
    state.role = "broker";
    const result = await changeManagerLeadStatusAction({}, form({ leadId: "lead-1", newStatus: "quote_sent" }));

    expect(result.error).toBeTruthy();
    expect(changeLeadStatus).not.toHaveBeenCalled();
  });

  it("refuses a manager without a unit", async () => {
    state.branchId = null;
    const result = await changeManagerLeadStatusAction({}, form({ leadId: "lead-1", newStatus: "quote_sent" }));

    expect(result.error).toBeTruthy();
    expect(changeLeadStatus).not.toHaveBeenCalled();
  });

  it("refuses a lead outside the manager's unit (the unit-scoped lookup finds nothing)", async () => {
    state.leadRows = [];
    const result = await changeManagerLeadStatusAction({}, form({ leadId: "lead-of-unit-b", newStatus: "quote_sent" }));

    expect(result.error).toBe("Este lead não está na sua unidade.");
    expect(changeLeadStatus).not.toHaveBeenCalled();
  });

  it("requires a loss reason when the new stage is lost", async () => {
    const refused = await changeManagerLeadStatusAction({}, form({ leadId: "lead-1", newStatus: "lost" }));
    expect(refused.error).toBe("Escolha o motivo da perda.");
    expect(changeLeadStatus).not.toHaveBeenCalled();

    const accepted = await changeManagerLeadStatusAction({}, form({ leadId: "lead-1", newStatus: "lost", motivoPerda: "preco" }));
    expect(accepted.success).toBe(true);
    expect(changeLeadStatus).toHaveBeenCalledWith(expect.objectContaining({ newStatus: "lost", motivoPerda: "preco" }));
  });
});
