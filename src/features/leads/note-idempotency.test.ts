import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => {
  const schema = {
    leads: { id: "leads.id", tenantId: "leads.tenantId", corretorId: "leads.corretorId", branchId: "leads.branchId", nome: "leads.nome" },
    leadInteractions: { id: "li.id", leadId: "li.leadId", userId: "li.userId", tipo: "li.tipo", metadata: "li.metadata" },
    auditLogs: "auditLogs",
  };
  const lead = { id: "lead-1", tenantId: "tenant-1", corretorId: "broker-1", branchId: "branch-1", nome: "Maria" };
  const notes: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const locks: string[] = [];
  const context = { tenantId: "tenant-1", userId: "broker-1", role: "broker" as "broker" | "manager" };
  type Condition = { field?: unknown; value?: unknown; values?: unknown[] };
  const flatten = (condition: unknown): Condition[] => (Array.isArray(condition) ? condition.flatMap(flatten) : [condition as Condition]);
  const db = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn((condition: unknown) => ({
          limit: vi.fn(async () => {
            if (table === schema.leads) return [{ ...lead }];
            const parts = flatten(condition);
            const raw = parts.find((part) => Array.isArray(part.values));
            const clientMessageId = raw?.values?.at(-1);
            return notes.filter((note) =>
              note.leadId === parts.find((part) => part.field === schema.leadInteractions.leadId)?.value
              && note.userId === parts.find((part) => part.field === schema.leadInteractions.userId)?.value
              && (note.metadata as { clientMessageId?: string } | undefined)?.clientMessageId === clientMessageId,
            ).map((note) => ({ id: note.id }));
          }),
        })),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn(async (values: Record<string, unknown>) => {
        (table === schema.leadInteractions ? notes : audits).push(values);
      }),
    })),
    execute: vi.fn(async (query: { values: unknown[] }) => { locks.push(String(query.values[0])); }),
    transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(db)),
  };
  return { schema, lead, notes, audits, locks, context, db, publish: vi.fn(async () => undefined) };
});

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: () => state.db, schema: state.schema }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.context }));
vi.mock("@/shared/auth/authorization", () => ({ assertTenantAccess: () => undefined }));
vi.mock("@/shared/auth/authorization-service", () => ({ AuthorizationService: { can: () => true } }));
vi.mock("@/features/leads/lead-authorization", () => ({ buildLeadResourceScope: (lead: unknown) => lead, toEffectiveLeadAccessContext: (context: unknown) => context }));
vi.mock("@/shared/auth/shadow-mode", () => ({ evaluateShadowAuthorization: vi.fn(async () => undefined) }));
vi.mock("@/features/notifications/send-push-helper", () => ({ publishNotification: state.publish }));
vi.mock("drizzle-orm", () => ({
  and: (...values: unknown[]) => values,
  eq: (field: unknown, value: unknown) => ({ field, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
}));

import { addLeadNoteAction } from "./actions";

function note(content: string, clientMessageId?: string) {
  const data = new FormData();
  data.set("leadId", state.lead.id);
  data.set("content", content);
  if (clientMessageId) data.set("clientMessageId", clientMessageId);
  return addLeadNoteAction({}, data);
}

describe("nota com chave de idempotência (conversa do Lite)", () => {
  beforeEach(() => {
    state.notes.length = 0;
    state.audits.length = 0;
    state.locks.length = 0;
    state.context.role = "broker";
    state.publish.mockClear();
  });

  it("o reenvio da mesma mensagem depois de um timeout não grava a nota duas vezes", async () => {
    expect(await note("Liguei para a Maria", "free-abc12345")).toEqual({ success: true });
    expect(await note("Liguei para a Maria", "free-abc12345")).toEqual({ success: true });
    expect(state.notes).toHaveLength(1);
    expect(state.notes[0]).toMatchObject({ conteudo: "Liguei para a Maria", metadata: { clientMessageId: "free-abc12345" } });
    expect(state.audits).toHaveLength(1);
    expect(state.locks).toEqual(["lead-note:lead-1:broker-1:free-abc12345", "lead-note:lead-1:broker-1:free-abc12345"]);
  });

  it("mensagens diferentes com o mesmo texto viram duas notas", async () => {
    await note("Sem resposta", "free-aaaaaaaa");
    await note("Sem resposta", "free-bbbbbbbb");
    expect(state.notes).toHaveLength(2);
  });

  it("sem chave continua como antes: grava sempre, sem lock", async () => {
    await note("Nota da ficha");
    await note("Nota da ficha");
    expect(state.notes).toHaveLength(2);
    expect(state.notes[0].metadata).toBeUndefined();
    expect(state.locks).toHaveLength(0);
  });

  it("o reenvio de gestor não notifica o corretor de novo", async () => {
    state.context.role = "manager";
    state.context.userId = "manager-1";
    try {
      await note("Ligue hoje", "free-mgr12345");
      await note("Ligue hoje", "free-mgr12345");
    } finally {
      state.context.userId = "broker-1";
    }
    expect(state.notes).toHaveLength(1);
    expect(state.publish).toHaveBeenCalledTimes(1);
  });

  it("recusa chave em formato inválido", async () => {
    expect(await note("Oi", "x; drop")).toHaveProperty("error");
    expect(state.notes).toHaveLength(0);
  });
});
