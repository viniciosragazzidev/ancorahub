import { beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ candidates: [] as unknown[], select: vi.fn() }));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => ({ select: state.select }) }));
import { resolveLeadForExtension } from "./lead-context";
import { extensionLeadPayloadSchema } from "./payload";
import type { LeadAmpliado } from "../../../apps/browser-extension/src/shared/types";

const context = { userId: "broker-a", tenantId: "tenant-a", branchId: "branch-a", role: "broker" as const, jobTitle: "broker" };
const row = { id: "lead-a", tenantId: "tenant-a", nome: "Cliente de teste", telefone: "+5511999990000", status: "new_lead",
  version: 1, qualificationStatus: "hot", origem: "manual", sourceCampaign: null, branchId: "branch-a", branchName: "Unidade A",
  corretorId: "broker-a", corretorName: "Corretor A", cpf: "never-export", internalNotes: "never-export", commission: 123 };
function query(rows: unknown[]) {
  const result = { from: () => result, leftJoin: () => result, innerJoin: () => result, where: () => result, orderBy: () => result,
    limit: async (limit: number) => rows.slice(0, limit), then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve) };
  return result;
}

beforeEach(() => {
  state.candidates = [];
  state.select.mockImplementation(() => {
    return query(state.candidates);
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
    state.select.mockReturnValueOnce(query([{ ...row, planName: "Plano de teste", queueName: "Fila A", dutyName: "Plantão A",
      livesCount: 3, monthlyValue: "199.90", assignedAt: new Date("2026-11-02T12:00:00Z") }]))
      .mockReturnValueOnce(query([{ id: "task-a", title: "Enviar cotação", dueAt: null, description: "never-export" }]))
      .mockReturnValueOnce(query([{ offeredAt: new Date("2026-11-03T12:00:00Z"), dutyName: "Plantão da oferta" }]))
      .mockReturnValueOnce(query(Array.from({ length: 6 }, () => ({ tipo: "note", createdAt: new Date("2026-11-03T13:00:00Z"), conteudo: "never-export" }))));
    const result = await resolveLeadForExtension(context, row.telefone);
    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") throw new Error("Lead autorizado não retornou");
    // Compile-time contract: the server payload remains assignable to the extension's shared type.
    const clientContract: LeadAmpliado = result.lead;
    expect(clientContract.etapa).toBe(result.lead.currentStatus.label);
    expect(Object.keys(result.lead).sort()).toEqual(["id", "version", "name", "phoneMasked", "currentStatus", "origin", "sourceCampaign", "unit", "assignedUser", "nextAction", "qualification", "allowedActions",
      "etapa", "unidade", "corretor", "proximoPasso", "temperatura", "plano", "vidas", "valorMensal", "fila", "plantao", "chegouEm", "historico"].sort());
    expect(result.lead).toMatchObject({ temperatura: "quente", plano: "Plano de teste", vidas: 3, valorMensal: 199.9,
      fila: "Fila A", plantao: "Plantão da oferta", chegouEm: "2026-11-03T12:00:00.000Z", proximoPasso: { titulo: "Enviar cotação", prazo: null } });
    expect(result.lead.historico).toHaveLength(5);
    expect(result.lead.historico.every((item) => Object.keys(item).sort().join() === "data,tipo")).toBe(true);
    expect(extensionLeadPayloadSchema.safeParse(result.lead).success).toBe(true);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, cpf: "secret" }).success).toBe(false);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, assignedUser: { ...result.lead.assignedUser, commission: 100 } }).success).toBe(false);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, qualification: { ...result.lead.qualification, internalNotes: "secret" } }).success).toBe(false);
    expect(extensionLeadPayloadSchema.safeParse({ ...result.lead, historico: [{ ...result.lead.historico[0], conteudo: "secret" }] }).success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("never-export");
    expect(JSON.stringify(result)).not.toContain(row.telefone);
  });

  it("chegada usa assignedAt sem oferta vigente; vidas têm fallback do CRM e não exporta o form", async () => {
    state.select.mockReturnValueOnce(query([{ ...row, assignedAt: new Date("2026-11-01T12:00:00Z"), livesCount: null,
      formData: { qtdVidas: "2", cpf: "never-export" }, monthlyValue: null }]))
      .mockReturnValueOnce(query([])).mockReturnValueOnce(query([])).mockReturnValueOnce(query([]));
    const result = await resolveLeadForExtension(context, row.telefone);
    expect(result.status).toBe("FOUND");
    if (result.status !== "FOUND") throw new Error("Sem lead");
    expect(result.lead).toMatchObject({ vidas: 2, chegouEm: "2026-11-01T12:00:00.000Z", historico: [] });
    expect(result.lead.valorMensal).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("never-export");
  });
});
