/**
 * "Juntar com…" das etiquetas: o plano puro e a action contra um banco em memória que entende eq/and/inArray,
 * para provar o escopo da empresa (nada de outra corretora entra ou muda) e que nenhum par lead+etiqueta duplica.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { describeLeadTagDelete, describeLeadTagMerge, planLeadTagMerge } from "./rules";

type Row = Record<string, unknown>;
type Cond = { and?: Cond[]; eq?: [{ name: string }, unknown]; inArray?: [{ name: string }, unknown[]] } | undefined;

const state = vi.hoisted(() => {
  const table = (name: string, columns: string[]) => Object.assign({ __table: name }, Object.fromEntries(columns.map((column) => [column, { name: column }])));
  const schema = {
    leadTags: table("leadTags", ["id", "tenantId", "name", "colorHue"]),
    leadTagAssignments: table("leadTagAssignments", ["tenantId", "leadId", "tagId", "createdBy"]),
    auditLogs: table("auditLogs", ["id", "userId", "entidade", "entidadeId", "acao"]),
  };
  const data: Record<string, Row[]> = { leadTags: [], leadTagAssignments: [], auditLogs: [] };
  return { schema, data, context: { tenantId: "t1", userId: "u1", role: "director", jobTitle: "director", branchId: null } as Record<string, unknown> };
});

function matches(row: Row, cond: Cond): boolean {
  if (!cond) return true;
  if (cond.and) return cond.and.every((part) => matches(row, part));
  if (cond.eq) return row[cond.eq[0].name] === cond.eq[1];
  if (cond.inArray) return cond.inArray[1].includes(row[cond.inArray[0].name]);
  return true;
}

function project(rows: Row[], fields: Record<string, { name: string }>) {
  return rows.map((row) => Object.fromEntries(Object.entries(fields).map(([key, column]) => [key, row[column.name]])));
}

const db = {
  select: (fields: Record<string, { name: string }>) => ({
    from: (table: { __table: string }) => ({
      where: async (cond: Cond) => project(state.data[table.__table]!.filter((row) => matches(row, cond)), fields),
    }),
  }),
  update: (table: { __table: string }) => ({
    set: (values: Row) => ({
      where: async (cond: Cond) => {
        for (const row of state.data[table.__table]!) if (matches(row, cond)) Object.assign(row, values);
        // Mesma chave primária do banco real: (lead, etiqueta) nunca repete.
        const seen = new Set<string>();
        for (const row of state.data.leadTagAssignments!) {
          const key = `${row.leadId}:${row.tagId}`;
          if (seen.has(key)) throw new Error("duplicate key lead_tag_assignments_pkey");
          seen.add(key);
        }
      },
    }),
  }),
  delete: (table: { __table: string }) => ({
    where: (cond: Cond) => {
      const run = () => {
        const removed = state.data[table.__table]!.filter((row) => matches(row, cond));
        state.data[table.__table] = state.data[table.__table]!.filter((row) => !matches(row, cond));
        return removed;
      };
      return {
        then: (resolve: (value: unknown) => void, reject: (error: unknown) => void) => { try { run(); resolve(undefined); } catch (error) { reject(error); } },
        returning: async (fields: Record<string, { name: string }>) => project(run(), fields),
      };
    },
  }),
  insert: (table: { __table: string }) => ({ values: async (values: Row) => { state.data[table.__table]!.push(values); } }),
  transaction: async <T,>(work: (tx: unknown) => Promise<T>): Promise<T> => {
    const snapshot = JSON.parse(JSON.stringify(state.data)) as typeof state.data;
    try {
      return await work(db);
    } catch (error) {
      for (const key of Object.keys(snapshot)) state.data[key] = snapshot[key]!;
      throw error;
    }
  },
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

import { mergeLeadTagsAction } from "./actions";

const assignments = () => state.data.leadTagAssignments!.map((row) => `${row.tenantId}:${row.leadId}:${row.tagId}`).sort();

describe("planLeadTagMerge", () => {
  it("move só quem não tem o destino e conta todos que saem da origem", () => {
    expect(planLeadTagMerge({ sourceLeadIds: ["l1", "l2", "l2", "l3"], targetLeadIds: ["l2", "l9"] }))
      .toEqual({ move: ["l1", "l3"], alreadyTagged: ["l2"], leaving: 3 });
  });

  it("origem vazia não move nada", () => {
    expect(planLeadTagMerge({ sourceLeadIds: [], targetLeadIds: ["l1"] })).toEqual({ move: [], alreadyTagged: [], leaving: 0 });
  });

  it("descreve o impacto exato, no singular e no plural", () => {
    expect(describeLeadTagMerge({ sourceName: "Retornar", targetName: "Ligar", leaving: 1 })).toContain("sai de 1 lead e é excluída");
    expect(describeLeadTagMerge({ sourceName: "Retornar", targetName: "Ligar", leaving: 12 })).toContain("sai de 12 leads");
    expect(describeLeadTagMerge({ sourceName: "Retornar", targetName: "Ligar", leaving: 0 })).toContain("não está em nenhum lead");
    expect(describeLeadTagDelete({ name: "VIP", leadCount: 3 })).toBe("\"VIP\" sai de 3 leads. Não dá para desfazer.");
    for (const text of [describeLeadTagMerge({ sourceName: "a", targetName: "b", leaving: 2 }), describeLeadTagDelete({ name: "a", leadCount: 0 })]) expect(text).not.toContain("—");
  });
});

describe("mergeLeadTagsAction", () => {
  beforeEach(() => {
    state.context = { tenantId: "t1", userId: "u1", role: "director", jobTitle: "director", branchId: null };
    state.data.leadTags = [
      { id: "a", tenantId: "t1", name: "Retornar", colorHue: 10 },
      { id: "b", tenantId: "t1", name: "Ligar", colorHue: 200 },
      { id: "x", tenantId: "t2", name: "Outra empresa", colorHue: 90 },
    ];
    state.data.leadTagAssignments = [
      { tenantId: "t1", leadId: "l1", tagId: "a" },
      { tenantId: "t1", leadId: "l2", tagId: "a" },
      { tenantId: "t1", leadId: "l2", tagId: "b" },
      { tenantId: "t1", leadId: "l3", tagId: "b" },
      { tenantId: "t2", leadId: "l9", tagId: "x" },
    ];
    state.data.auditLogs = [];
  });

  it("move as atribuições sem duplicar o par e apaga a etiqueta de origem", async () => {
    const result = await mergeLeadTagsAction({ sourceId: "a", targetId: "b" });
    expect(result).toEqual({ success: true, data: { target: { id: "b", name: "Ligar", colorHue: 200 }, moved: 1, alreadyTagged: 1, leaving: 2 } });
    expect(assignments()).toEqual(["t1:l1:b", "t1:l2:b", "t1:l3:b", "t2:l9:x"]);
    expect(state.data.leadTags!.map((tag) => tag.id)).toEqual(["b", "x"]);
    expect(state.data.auditLogs).toEqual([expect.objectContaining({ acao: "lead_tag.merged", entidadeId: "b", userId: "u1" })]);
  });

  it("não junta com etiqueta de outra empresa e não muda nada", async () => {
    const before = assignments();
    const result = await mergeLeadTagsAction({ sourceId: "a", targetId: "x" });
    expect(result).toEqual({ success: false, error: "Etiqueta não encontrada." });
    expect(assignments()).toEqual(before);
    expect(state.data.leadTags).toHaveLength(3);
  });

  it("de outra empresa, nem a origem é encontrada", async () => {
    state.context = { ...state.context, tenantId: "t2" };
    const result = await mergeLeadTagsAction({ sourceId: "a", targetId: "x" });
    expect(result).toMatchObject({ success: false, error: "Etiqueta não encontrada." });
    expect(state.data.leadTags).toHaveLength(3);
  });

  it("recusa juntar a etiqueta com ela mesma e quem não gerencia etiquetas", async () => {
    expect(await mergeLeadTagsAction({ sourceId: "a", targetId: "a" })).toMatchObject({ success: false, error: "Escolha outra etiqueta para juntar." });
    state.context = { ...state.context, role: "broker", jobTitle: "broker" };
    expect(await mergeLeadTagsAction({ sourceId: "a", targetId: "b" })).toMatchObject({ success: false, error: expect.stringMatching(/Diretores e Gestores/) });
    expect(state.data.leadTags).toHaveLength(3);
  });
});
