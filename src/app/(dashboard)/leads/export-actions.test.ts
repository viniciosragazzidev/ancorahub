import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const col = (table: string, name: string) => ({ table, name });
  const schema = {
    leads: {
      id: col("leads", "id"), nome: col("leads", "nome"), telefone: col("leads", "telefone"), email: col("leads", "email"),
      status: col("leads", "status"), origem: col("leads", "origem"), sourceChannel: col("leads", "sourceChannel"),
      sourceCampaign: col("leads", "sourceCampaign"), monthlyValue: col("leads", "monthlyValue"), livesCount: col("leads", "livesCount"),
      createdAt: col("leads", "createdAt"), assignedAt: col("leads", "assignedAt"), updatedAt: col("leads", "updatedAt"),
      corretorId: col("leads", "corretorId"), queueId: col("leads", "queueId"), branchId: col("leads", "branchId"), deletedAt: col("leads", "deletedAt"),
    },
    user: { id: col("user", "id"), name: col("user", "name") },
    leadQueues: { id: col("leadQueues", "id"), name: col("leadQueues", "name"), tenantId: col("leadQueues", "tenantId") },
    branches: { id: col("branches", "id"), name: col("branches", "name"), tenantId: col("branches", "tenantId") },
    auditLogs: Symbol("auditLogs"),
  };
  const rows: unknown[] = [];
  const wheres: unknown[] = [];
  const inserts: Array<Record<string, unknown>> = [];
  const query = {
    from: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(async (condition: unknown) => {
      wheres.push(condition);
      return rows;
    }),
  };
  const db = {
    select: vi.fn(() => query),
    insert: vi.fn(() => ({ values: vi.fn(async (values: Record<string, unknown>) => { inserts.push(values); }) })),
  };
  return {
    schema, rows, wheres, inserts, db,
    context: { tenantId: "t1", userId: "u1", role: "manager", jobTitle: "manager", branchId: "b1" } as Record<string, unknown>,
    access: { permissions: new Set(["acessar_leads"]), scope: { teamScoped: false } } as { permissions: Set<string>; scope: { teamScoped: boolean } },
    routeAllowed: true,
  };
});

vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/shared/auth/access-context", () => ({ resolveAccessContext: async () => ({ ...state.context, ...state.access }) }));
vi.mock("@/features/custom-roles/service", () => ({ hasEffectiveRouteAccess: async () => state.routeAllowed }));
vi.mock("@/features/leads/lead-authorization", () => ({
  buildLeadScopeWhere: (access: { role: string; branchId: string }) => ({ scope: access.role, branchId: access.branchId }),
}));
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ and: args.filter(Boolean) }),
  eq: (field: unknown, value: unknown) => ({ eq: [field, value] }),
  inArray: (field: unknown, values: unknown[]) => ({ inArray: [field, values] }),
  isNull: (field: unknown) => ({ isNull: field }),
}));

import { exportSelectedLeadsAction } from "./export-actions";

const visibleLead = {
  id: "l1", nome: "Maria", telefone: "21 90000-0001", email: null, status: "new", corretorNome: "Ana", queueName: "PME",
  branchName: "Centro", origem: "meta", sourceChannel: "meta_lead_ads", sourceCampaign: null, monthlyValue: null, livesCount: 2,
  createdAt: new Date("2026-11-20T13:00:00.000Z"), assignedAt: null, updatedAt: null,
};

describe("exportSelectedLeadsAction", () => {
  beforeEach(() => {
    state.rows.length = 0;
    state.wheres.length = 0;
    state.inserts.length = 0;
    state.context.role = "manager";
    state.access = { permissions: new Set(["acessar_leads"]), scope: { teamScoped: false } };
    state.routeAllowed = true;
    vi.clearAllMocks();
  });

  it("filtra pelo escopo do usuário e pelos ids pedidos, sem excluídos", async () => {
    state.rows.push(visibleLead);
    const result = await exportSelectedLeadsAction(["l1", "l2", "l1"]);
    expect(result).toMatchObject({ ok: true, exported: 1, requested: 2 });
    expect(state.wheres[0]).toEqual({
      and: [
        { scope: "manager", branchId: "b1" },
        { inArray: [state.schema.leads.id, ["l1", "l2"]] },
        { isNull: state.schema.leads.deletedAt },
      ],
    });
    if (result.ok) {
      expect(result.csv.startsWith("﻿")).toBe(true);
      expect(result.csv).toContain("\"Maria\";\"21 90000-0001\"");
      expect(result.csv).not.toContain("l2");
    }
    expect(state.inserts[0]).toMatchObject({ entidade: "report", entidadeId: "selected_leads", metadata: { requested: 2, count: 1, format: "csv" } });
  });

  it("não devolve nada quando nenhum lead está no escopo", async () => {
    await expect(exportSelectedLeadsAction(["l9"])).resolves.toEqual({ ok: false, error: "Nenhum dos leads selecionados está no seu acesso." });
    expect(state.inserts).toHaveLength(0);
  });

  it("bloqueia quem não tem acesso a leads, sem consultar o banco", async () => {
    state.access = { permissions: new Set(), scope: { teamScoped: false } };
    await expect(exportSelectedLeadsAction(["l1"])).resolves.toMatchObject({ ok: false });
    state.access = { permissions: new Set(["acessar_leads"]), scope: { teamScoped: false } };
    state.routeAllowed = false;
    await expect(exportSelectedLeadsAction(["l1"])).resolves.toMatchObject({ ok: false });
    expect(state.db.select).not.toHaveBeenCalled();
  });

  it("supervisor sem equipe ativa não exporta", async () => {
    state.context.role = "supervisor";
    await expect(exportSelectedLeadsAction(["l1"])).resolves.toEqual({ ok: false, error: "Este supervisor não tem uma equipe ativa no escopo." });
    expect(state.db.select).not.toHaveBeenCalled();
  });

  it("corretor recebe o arquivo sem a origem do lead", async () => {
    state.context.role = "broker";
    state.rows.push(visibleLead);
    const result = await exportSelectedLeadsAction(["l1"]);
    expect(result.ok && result.csv).not.toContain("Meta");
  });

  it("recusa seleção vazia ou grande demais", async () => {
    await expect(exportSelectedLeadsAction([])).resolves.toMatchObject({ ok: false });
    await expect(exportSelectedLeadsAction("l1")).resolves.toMatchObject({ ok: false });
    await expect(exportSelectedLeadsAction(Array.from({ length: 2001 }, (_, i) => `l${i}`))).resolves.toMatchObject({ ok: false });
    expect(state.db.select).not.toHaveBeenCalled();
  });
});
