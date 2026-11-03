import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ candidates: [] as unknown[], select: vi.fn() }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ select: state.select }) }));
import { resolveLeadForExtension } from "./lead-context";
import { extensionLeadPayloadSchema } from "./payload";

const context = { userId: "broker-a", tenantId: "tenant-a", branchId: "branch-a", role: "broker" as const, jobTitle: "broker" };
const row = { id: "lead-a", tenantId: "tenant-a", nome: "Cliente de teste", telefone: "+5511999990000", status: "new_lead",
  version: 1, qualificationStatus: "qualified", origem: "manual", sourceCampaign: null, branchId: "branch-a", branchName: "Unidade A",
  corretorId: "broker-a", corretorName: "Corretor A", cpf: "never-export", internalNotes: "never-export", commission: 123 };

beforeEach(() => {
  state.candidates = [];
  state.select.mockImplementation(() => {
    const query = { leftJoin: () => query, from: () => query, where: async () => state.candidates };
    return query;
  });
});
describe("contrato fechado do lead e enumeração", () => {
  it("mesma resposta para inexistente, outro dono e outra unidade", async () => {
    for (const candidates of [[], [{ ...row, corretorId: "broker-b" }], [{ ...row, branchId: "branch-b" }]]) {
      state.candidates = candidates;
      expect(await resolveLeadForExtension(context, row.telefone)).toEqual({ status: "NOT_FOUND" });
    }
  });

  it("payload real só contém allowlist revisada, inclusive objetos aninhados", async () => {
    const tasks = { from: () => tasks, where: () => tasks, orderBy: () => tasks, limit: async () => [] };
    const candidates = { from: () => candidates, leftJoin: () => candidates, where: async () => [row] };
    state.select.mockReturnValueOnce(candidates).mockReturnValueOnce(tasks);
    const result = await resolveLeadForExtension(context, row.telefone);
    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") throw new Error("Lead autorizado não retornou");
    expect(Object.keys(result.lead).sort()).toEqual(["id", "version", "name", "phoneMasked", "currentStatus", "origin", "sourceCampaign", "unit", "assignedUser", "nextAction", "qualification", "allowedActions"].sort());
    expect(extensionLeadPayloadSchema.safeParse(result.lead).success).toBe(true);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, cpf: "secret" }).success).toBe(false);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, assignedUser: { ...result.lead.assignedUser, commission: 100 } }).success).toBe(false);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, qualification: { ...result.lead.qualification, internalNotes: "secret" } }).success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("never-export");
    expect(JSON.stringify(result)).not.toContain(row.telefone);
  });
});
