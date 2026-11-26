/**
 * "Etiquetar" em lote: o plano puro e a action contra um banco em memória que entende eq/and/inArray, para provar
 * que só leads da empresa e do escopo de quem pede mudam e que nenhum par lead+etiqueta duplica.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { describeBulkLeadTag, planBulkLeadTag } from "./rules";

type Row = Record<string, unknown>;
type Cond = { and?: Cond[]; eq?: [{ name: string }, unknown]; inArray?: [{ name: string }, unknown[]] } | undefined;

const state = vi.hoisted(() => {
  const table = (name: string, columns: string[]) => Object.assign({ __table: name }, Object.fromEntries(columns.map((column) => [column, { name: column }])));
  const schema = {
    leads: table("leads", ["id", "tenantId", "corretorId", "branchId"]),
    leadTags: table("leadTags", ["id", "tenantId", "name", "colorHue"]),
    leadTagAssignments: table("leadTagAssignments", ["tenantId", "leadId", "tagId", "createdBy"]),
    auditLogs: table("auditLogs", ["id", "userId", "entidade", "entidadeId", "acao"]),
  };
  const data: Record<string, Row[]> = { leads: [], leadTags: [], leadTagAssignments: [], auditLogs: [] };
  return { schema, data, context: {} as Record<string, unknown> };
});

function matches(row: Row, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.and) return cond.and.every((part) => matches(row, part));
  if (cond.eq) return row[cond.eq[0].name] === cond.eq[1];
  if (cond.inArray) return cond.inArray[1].includes(row[cond.inArray[0].name]);
  return true;
}

const project = (rows: Row[], fields: Record<string, { name: string }>) =>
  rows.map((row) => Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.name]])));

const db = {
  select: (fields: Record<string, { name: string }>) => ({
    from: (table: { __table: string }) => ({
      where: async (cond: Cond) => project(state.data[table.__table]!.filter((row) => matches(row, cond)), fields),
    }),
  }),
  delete: (table: { __table: string }) => ({
    where: async (cond: Cond) => { state.data[table.__table] = state.data[table.__table]!.filter((row) => !matches(row, cond)); },
  }),
  insert: (table: { __table: string }) => ({
    values: (values: Row | Row[]) => {
      const rows = Array.isArray(values) ? values : [values];
      const push = (ignoreConflict: boolean) => {
        for (const row of rows) {
          const duplicate = table.__table === "leadTagAssignments" && state.data.leadTagAssignments!.some((item) => item.leadId === row.leadId && item.tagId === row.tagId);
          if (duplicate && ignoreConflict) continue;
          if (duplicate) throw new Error("duplicate key lead_tag_assignments_pkey");
          state.data[table.__table]!.push(row);
        }
      };
      return {
        onConflictDoNothing: async () => push(true),
        then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => { try { push(false); resolve(undefined); } catch (error) { reject(error); } },
      };
    },
  }),
  transaction: async <T,>(work: (tx: unknown) => Promise<T>): Promise<T> => work(db),
};

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/db", () => ({ getDatabase: () => db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("drizzle-orm", () => ({
  and: (...parts: unknown[]) => ({ and: parts.filter(Boolean) }),
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  inArray: (column: unknown, values: unknown[]) => ({ inArray: [column, values] }),
  ne: () => undefined,
  asc: () => undefined,
  count: () => undefined,
  sql: () => undefined,
}));

import { bulkSetLeadTagAction } from "./actions";

const pairs = () => state.data.leadTagAssignments!.map((row) => `${row.tenantId}:${row.leadId}:${row.tagId}`).sort();

describe("planBulkLeadTag", () => {
  const leads = [
    { id: "l1", corretorId: "c1", branchId: "b1" },
    { id: "l2", corretorId: "c2", branchId: "b1" },
    { id: "l3", corretorId: "c3", branchId: "b2" },
  ];

  it("aplicar: muda só quem não tem; quem já tem fica igual; o que não veio da empresa fica de fora", () => {
    const plan = planBulkLeadTag({ context: { role: "director", userId: "d1", branchId: null }, requestedIds: ["l1", "l2", "l3", "x9"], leads, taggedLeadIds: ["l2"], mode: "add" });
    expect(plan).toEqual({ change: ["l1", "l3"], unchanged: ["l2"], skipped: 1 });
  });

  it("gestor só mexe nos leads da unidade dele; corretor só nos dele", () => {
    expect(planBulkLeadTag({ context: { role: "manager", userId: "g1", branchId: "b1" }, requestedIds: ["l1", "l2", "l3"], leads, taggedLeadIds: [], mode: "add" }))
      .toEqual({ change: ["l1", "l2"], unchanged: [], skipped: 1 });
    expect(planBulkLeadTag({ context: { role: "broker", userId: "c1", branchId: "b1" }, requestedIds: ["l1", "l2"], leads, taggedLeadIds: ["l1"], mode: "remove" }))
      .toEqual({ change: ["l1"], unchanged: [], skipped: 1 });
  });

  it("descreve o resultado sem travessão", () => {
    expect(describeBulkLeadTag({ tagName: "VIP", mode: "add", changed: 2, unchanged: 1, skipped: 1 }))
      .toBe("\"VIP\" aplicada em 2 leads. 1 lead já tinha. 1 lead fora do seu escopo ficou de fora.");
    expect(describeBulkLeadTag({ tagName: "VIP", mode: "remove", changed: 0, unchanged: 3, skipped: 0 })).toBe("Nenhum lead tinha \"VIP\".");
  });
});

describe("bulkSetLeadTagAction", () => {
  beforeEach(() => {
    state.context = { tenantId: "t1", userId: "g1", role: "manager", jobTitle: "manager", branchId: "b1" };
    state.data.leads = [
      { id: "l1", tenantId: "t1", corretorId: "c1", branchId: "b1" },
      { id: "l2", tenantId: "t1", corretorId: "c2", branchId: "b1" },
      { id: "l3", tenantId: "t1", corretorId: "c3", branchId: "b2" },
      { id: "l9", tenantId: "t2", corretorId: "c9", branchId: "b1" },
    ];
    state.data.leadTags = [
      { id: "vip", tenantId: "t1", name: "VIP", colorHue: 10 },
      { id: "outra", tenantId: "t2", name: "Outra empresa", colorHue: 90 },
    ];
    state.data.leadTagAssignments = [{ tenantId: "t1", leadId: "l2", tagId: "vip" }];
    state.data.auditLogs = [];
  });

  it("aplica nos leads da unidade, sem duplicar, e deixa de fora outra unidade e outra empresa", async () => {
    const result = await bulkSetLeadTagAction({ leadIds: ["l1", "l2", "l3", "l9"], tagId: "vip", mode: "add" });
    expect(result).toEqual({ success: true, data: expect.objectContaining({ changed: 1, unchanged: 1, skipped: 2, changedLeadIds: ["l1"] }) });
    expect(pairs()).toEqual(["t1:l1:vip", "t1:l2:vip"]);
    expect(state.data.auditLogs).toEqual([expect.objectContaining({ entidade: "lead_tag", entidadeId: "vip", acao: "lead_tag.bulk_added:1" })]);
  });

  it("remove só de quem tinha", async () => {
    const result = await bulkSetLeadTagAction({ leadIds: ["l1", "l2"], tagId: "vip", mode: "remove" });
    expect(result).toMatchObject({ success: true, data: { changed: 1, unchanged: 1, changedLeadIds: ["l2"] } });
    expect(pairs()).toEqual([]);
  });

  it("etiqueta de outra empresa não é encontrada e nada muda", async () => {
    const result = await bulkSetLeadTagAction({ leadIds: ["l1"], tagId: "outra", mode: "add" });
    expect(result).toEqual({ success: false, error: "Etiqueta não encontrada." });
    expect(pairs()).toEqual(["t1:l2:vip"]);
  });

  it("recusa quando nenhum lead está no escopo, e pede seleção", async () => {
    expect(await bulkSetLeadTagAction({ leadIds: ["l3", "l9"], tagId: "vip", mode: "add" })).toMatchObject({ success: false, error: "Você não pode alterar as etiquetas destes leads." });
    expect(await bulkSetLeadTagAction({ leadIds: [], tagId: "vip", mode: "add" })).toMatchObject({ success: false, error: "Selecione ao menos um lead." });
    expect(pairs()).toEqual(["t1:l2:vip"]);
  });
});
