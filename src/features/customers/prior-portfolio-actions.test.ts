import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  context: { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" } as Record<string, unknown>,
  enabled: true,
  duplicate: null as unknown,
  ownClient: { id: "11111111-1111-4111-8111-111111111111", name: "Ana", email: null, originNote: null, branchId: "unit-a" } as Row | null,
  inserts: [] as { table: string; values: Row }[],
  updates: [] as Row[],
  deleted: [{ id: "c1" }] as Row[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/features/leads/manual-create", () => ({ normalizePhone: (phone: string) => `55${phone}` }));
vi.mock("./prior-portfolio", () => ({
  isBrokerPriorClientsEnabled: async () => state.enabled,
  findPriorPortfolioDuplicate: async () => state.duplicate,
  loadOwnPriorClient: async () => state.ownClient,
}));
vi.mock("./prior-portfolio-schema", () => ({ portfolioClients: { __name: "clients", id: "id", tenantId: "t", corretorId: "c", source: "s" } }));
vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}) }));
vi.mock("@/shared/db", () => {
  const name = (table: { __name?: string }) => table.__name ?? "unknown";
  const tx = {
    insert: (table: { __name?: string }) => ({ values: async (values: Row) => { state.inserts.push({ table: name(table), values }); } }),
    update: () => ({ set: (values: Row) => ({ where: () => { state.updates.push(values); const result = Promise.resolve(undefined) as Promise<undefined> & { returning: () => Promise<Row[]> }; result.returning = async () => [{ id: "c1" }]; return result; } }) }),
    delete: () => ({ where: () => ({ returning: async () => state.deleted }) }),
  };
  return {
    schema: { auditLogs: { __name: "audit_logs" }, clientPriorContracts: { __name: "client_prior_contracts", id: "id", clientId: "client_id", tenantId: "tenant_id", brokerId: "broker_id" } },
    getDatabase: () => ({ ...tx, transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx) }),
  };
});

import { createPriorClientAction, removePriorContractAction, savePriorContractAction, updatePriorClientAction } from "./prior-portfolio-actions";

const valid = {
  nome: "Ana Prévia",
  telefone: "11 98888-7777",
  email: "",
  observacao: "Indicação",
  contracts: [{ productType: "PF", carrierName: "Operadora X", renewalDate: "2026-12-01", status: "active" }],
};
const audits = () => state.inserts.filter((insert) => insert.table === "audit_logs").map((insert) => insert.values);

beforeEach(() => {
  state.context = { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" };
  state.enabled = true;
  state.duplicate = null;
  state.ownClient = { id: "11111111-1111-4111-8111-111111111111", name: "Ana", email: null, originNote: null, branchId: "unit-a" };
  state.inserts = [];
  state.updates = [];
  state.deleted = [{ id: "c1" }];
});

describe("Cliente que já possuo: actions", () => {
  it("cria o cliente sem lead, com origem prior_portfolio, tenant e corretor da sessão, e audita cada contrato", async () => {
    const result = await createPriorClientAction({ ...valid, tenantId: "tenant-b", corretorId: "broker-b" });
    expect(result).toMatchObject({ ok: true });
    const client = state.inserts.find((insert) => insert.table === "clients")!.values;
    expect(client).toMatchObject({ tenantId: "tenant-a", corretorId: "broker-a", leadId: null, source: "prior_portfolio", telefone: "5511988887777", originNote: "Indicação", createdBy: "broker-a" });
    const contract = state.inserts.find((insert) => insert.table === "client_prior_contracts")!.values;
    expect(contract).toMatchObject({ tenantId: "tenant-a", brokerId: "broker-a", productType: "PF", carrierName: "Operadora X", renewalDate: "2026-12-01", coverageStartDate: null, status: "active" });
    expect(Object.keys(contract).some((key) => /sale|value|commission/i.test(key))).toBe(false);
    expect(audits().map((audit) => audit.acao)).toEqual(["client.prior_portfolio.created", "client_prior_contract.created"]);
    expect(audits()[0]).toMatchObject({ userId: "broker-a", metadata: expect.objectContaining({ tenantId: "tenant-a" }) });
    // Nada de lead, venda ou pontos.
    expect(state.inserts.map((insert) => insert.table)).toEqual(["clients", "audit_logs", "client_prior_contracts", "audit_logs"]);
  });

  it("duplicidade fora do escopo: aviso sem dados e auditoria do bloqueio", async () => {
    state.duplicate = { mine: false };
    const result = await createPriorClientAction(valid);
    expect(result).toEqual({ ok: false, duplicate: { mine: false } });
    expect(audits()).toHaveLength(1);
    expect(audits()[0]).toMatchObject({ acao: "client.prior_portfolio.duplicate_blocked", metadata: { tenantId: "tenant-a", mine: false } });
    expect(state.inserts.some((insert) => insert.table === "clients")).toBe(false);
  });

  it("duplicidade do próprio corretor mostra o registro dele e a confirmação libera o cadastro", async () => {
    state.duplicate = { mine: true, href: "/clientes/x", name: "Ana" };
    expect(await createPriorClientAction(valid)).toEqual({ ok: false, duplicate: { mine: true, href: "/clientes/x", name: "Ana" } });
    state.inserts = [];
    expect(await createPriorClientAction({ ...valid, duplicateConfirmed: true })).toMatchObject({ ok: true });
  });

  it("recusa com a chave desligada, para outro papel e com entrada inválida", async () => {
    state.enabled = false;
    expect(await createPriorClientAction(valid)).toMatchObject({ ok: false, error: expect.stringContaining("não está disponível") });
    state.enabled = true;
    state.context = { ...state.context, role: "manager" };
    expect(await createPriorClientAction(valid)).toMatchObject({ ok: false });
    state.context = { ...state.context, role: "broker" };
    expect(await createPriorClientAction({ ...valid, telefone: "1" })).toMatchObject({ ok: false, fieldErrors: { telefone: expect.any(String) } });
    expect(state.inserts).toHaveLength(0);
  });

  it("edição e contratos só no cliente do próprio corretor, sempre auditados", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    expect(await updatePriorClientAction({ clientId, nome: "Ana Souza", email: "", observacao: "" })).toEqual({ ok: true });
    expect(audits().at(-1)).toMatchObject({ acao: "client.prior_portfolio.updated", metadata: expect.objectContaining({ changed: ["nome"] }) });

    expect(await savePriorContractAction({ clientId, contract: { productType: "odonto" } })).toMatchObject({ ok: true });
    expect(audits().at(-1)).toMatchObject({ acao: "client_prior_contract.created" });

    expect(await savePriorContractAction({ clientId, contractId: "22222222-2222-4222-8222-222222222222", contract: { status: "cancelled" } })).toMatchObject({ ok: true });
    expect(audits().at(-1)).toMatchObject({ acao: "client_prior_contract.updated" });

    expect(await removePriorContractAction({ clientId, contractId: "22222222-2222-4222-8222-222222222222" })).toEqual({ ok: true });
    expect(audits().at(-1)).toMatchObject({ acao: "client_prior_contract.removed" });

    state.ownClient = null;
    expect(await removePriorContractAction({ clientId, contractId: "22222222-2222-4222-8222-222222222222" })).toEqual({ ok: false, error: "Cliente não encontrado na sua carteira." });
  });
});
