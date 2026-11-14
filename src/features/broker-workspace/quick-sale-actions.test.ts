import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" } as Record<string, unknown>,
  enabled: true,
  calls: [] as { context: unknown; query: string }[],
  fail: false,
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("./quick-sale-flag", () => ({ isBrokerQuickSaleEnabled: async () => state.enabled }));
vi.mock("./quick-sale-queries", () => ({
  listQuickSaleLeads: async (context: unknown, query: string) => {
    state.calls.push({ context, query });
    if (state.fail) throw new Error("db down");
    return [{ id: "lead-1", name: "Ana Souza", status: "under_analysis" }];
  },
}));

import { listQuickSaleLeadsAction } from "./quick-sale-actions";

beforeEach(() => {
  state.context = { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" };
  state.enabled = true;
  state.calls = [];
  state.fail = false;
});

describe("lista do Registrar venda", () => {
  it("usa a sessão do corretor e a busca validada", async () => {
    const result = await listQuickSaleLeadsAction({ query: "  Ana " });
    expect(result).toEqual({ ok: true, leads: [{ id: "lead-1", name: "Ana Souza", status: "under_analysis" }] });
    expect(state.calls).toEqual([{ context: state.context, query: "Ana" }]);
  });

  it("ignora tenant ou corretor vindos do cliente (entrada estrita)", async () => {
    const result = await listQuickSaleLeadsAction({ query: "Ana", tenantId: "tenant-b", userId: "broker-b" });
    expect(result.ok).toBe(false);
    expect(state.calls).toHaveLength(0);
  });

  it("recusa quem não é corretor e a chave desligada", async () => {
    state.context = { ...state.context, role: "manager" };
    expect((await listQuickSaleLeadsAction({})).ok).toBe(false);
    state.context = { ...state.context, role: "broker" };
    state.enabled = false;
    expect(await listQuickSaleLeadsAction({})).toEqual({ ok: false, error: "Registrar venda não está disponível no momento." });
    expect(state.calls).toHaveLength(0);
  });

  it("falha de leitura vira mensagem curta", async () => {
    state.fail = true;
    expect(await listQuickSaleLeadsAction(undefined)).toEqual({ ok: false, error: "Não foi possível carregar seus leads agora." });
  });
});
