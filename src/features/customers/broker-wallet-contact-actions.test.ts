import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  context: { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" } as Record<string, unknown>,
  enabled: true,
  createResult: { leadId: "lead-new" } as Record<string, unknown>,
  createError: null as unknown,
  ownLead: [] as { id: string; name: string }[],
  manualInputs: [] as unknown[],
  interactions: [] as unknown[],
  audits: [] as unknown[],
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("./broker-my-wallet-flag", () => ({ isBrokerMyWalletEnabled: async () => state.enabled }));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadScopeWhere: () => ({}) }));
vi.mock("@/features/leads/actions", () => ({
  createLeadInteraction: async (_db: unknown, data: unknown) => { state.interactions.push(data); },
}));
vi.mock("@/features/leads/manual-create", () => ({
  createManualLead: async (input: unknown) => {
    state.manualInputs.push(input);
    if (state.createError) throw state.createError;
    return state.createResult;
  },
}));
vi.mock("drizzle-orm", () => ({ and: () => ({}), eq: () => ({}), isNull: () => ({}) }));
vi.mock("@/shared/db", () => ({
  schema: { leads: { id: "id", nome: "nome", deletedAt: "deleted_at" }, auditLogs: {} },
  getDatabase: () => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => state.ownLead }) }) }),
    insert: () => ({ values: async (values: unknown) => { state.audits.push(values); } }),
  }),
}));

import { createBrokerWalletContactAction } from "./broker-wallet-contact-actions";

const valid = { nome: "Ana Souza", telefone: "(11) 99999-0000", email: "", observacao: "", consentimentoLgpd: true };

beforeEach(() => {
  state.context = { userId: "broker-a", tenantId: "tenant-a", role: "broker", jobTitle: "broker", branchId: "unit-a" };
  state.enabled = true;
  state.createResult = { leadId: "lead-new" };
  state.createError = null;
  state.ownLead = [];
  state.manualInputs = [];
  state.interactions = [];
  state.audits = [];
});

describe("Minha carteira: Novo interessado", () => {
  it("cadastra pelo cadastro manual existente, como PF e com consentimento", async () => {
    const result = await createBrokerWalletContactAction(valid);
    expect(result).toEqual({ ok: true, leadId: "lead-new", noteSaved: false });
    expect(state.manualInputs).toEqual([{ nome: "Ana Souza", telefone: "11999990000", email: "", tipo: "PF", consentimentoLgpd: "true" }]);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({ entidade: "lead", entidadeId: "lead-new", acao: "cadastro_minha_carteira", userId: "broker-a" });
  });

  it("grava a observação como primeira nota do lead", async () => {
    const result = await createBrokerWalletContactAction({ ...valid, observacao: "Prefere contato à tarde" });
    expect(result).toMatchObject({ ok: true, noteSaved: true });
    expect(state.interactions).toEqual([{ leadId: "lead-new", userId: "broker-a", tipo: "note", conteudo: "Prefere contato à tarde" }]);
  });

  it("valida no servidor antes de cadastrar", async () => {
    const result = await createBrokerWalletContactAction({ ...valid, telefone: "123", consentimentoLgpd: false });
    expect(result).toMatchObject({ ok: false, fieldErrors: { telefone: expect.any(String), consentimentoLgpd: expect.any(String) } });
    expect(state.manualInputs).toHaveLength(0);
  });

  it("não expõe dados quando o telefone é de outro corretor", async () => {
    state.createResult = { duplicate: { id: "lead-b", nome: "Cliente do Bruno", createdAt: new Date(), corretorNome: "Bruno" } };
    const result = await createBrokerWalletContactAction(valid);
    expect(result).toEqual({ ok: false, duplicate: { mine: false } });
    expect(JSON.stringify(result)).not.toContain("Bruno");
    expect(state.audits).toHaveLength(0);
  });

  it("mostra o próprio contato quando o telefone já é do corretor", async () => {
    state.createResult = { duplicate: { id: "lead-a", nome: "Ana", createdAt: new Date(), corretorNome: "Eu" } };
    state.ownLead = [{ id: "lead-a", name: "Ana" }];
    const result = await createBrokerWalletContactAction(valid);
    expect(result).toEqual({ ok: false, duplicate: { mine: true, leadId: "lead-a", name: "Ana" } });
  });

  it("repassa a confirmação de duplicidade ao cadastro manual", async () => {
    await createBrokerWalletContactAction({ ...valid, duplicateConfirmed: true });
    expect(state.manualInputs[0]).toMatchObject({ duplicateConfirmed: "true" });
  });

  it("recusa com as chaves desligadas ou para quem não é corretor", async () => {
    state.enabled = false;
    expect(await createBrokerWalletContactAction(valid)).toMatchObject({ ok: false, error: expect.stringContaining("não está disponível") });
    state.enabled = true;
    state.context = { ...state.context, role: "manager" };
    expect(await createBrokerWalletContactAction(valid)).toMatchObject({ ok: false });
    expect(state.manualInputs).toHaveLength(0);
  });

  it("troca falha técnica por mensagem genérica", async () => {
    state.createError = new Error("connection refused tenant-a");
    const result = await createBrokerWalletContactAction(valid);
    expect(result).toEqual({ ok: false, error: "Não foi possível cadastrar agora. Tente de novo." });
  });
});
