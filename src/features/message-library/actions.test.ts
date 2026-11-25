import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ role: "director" as string, writes: [] as unknown[] }));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => ({ userId: "u1", tenantId: "t1", role: state.role, jobTitle: state.role, branchId: null }),
}));
vi.mock("@/shared/db", () => {
  const chain = {
    values: (value: unknown) => { state.writes.push(value); return { onConflictDoUpdate: async () => undefined, then: (resolve: (v: unknown) => void) => resolve(undefined) }; },
  };
  return {
    schema: { aiQuickReplyTemplates: { tenantId: "tenant_id", ruleKey: "rule_key" }, auditLogs: {} },
    getDatabase: () => ({ insert: () => chain }),
  };
});

import { listTeamQuickRepliesAction, saveQuickReplyTextAction, saveTeamQuickReplyAction } from "./actions";

describe("saving an AI quick reply text", () => {
  beforeEach(() => { state.role = "director"; state.writes = []; });

  it("accepts {{nome}} and {{resumo}}", async () => {
    expect(await saveQuickReplyTextAction({ ruleKey: "human.requested", body: "Claro, {{nome}}! ({{resumo}})" })).toEqual({ success: true });
    expect(state.writes[0]).toMatchObject({ ruleKey: "human.requested", body: "Claro, {{nome}}! ({{resumo}})", active: true });
  });

  it("refuses a variable the AI cannot fill, an unknown situation and a broker", async () => {
    expect(await saveQuickReplyTextAction({ ruleKey: "human.requested", body: "Oi {{empresa}}" })).toEqual({ success: false, error: expect.stringContaining("{{empresa}}") });
    expect(await saveQuickReplyTextAction({ ruleKey: "greeting.initial", body: "Olá!" })).toEqual({ success: false, error: "Situação da IA desconhecida." });
    state.role = "broker";
    expect((await saveQuickReplyTextAction({ ruleKey: "human.requested", body: "Olá!" })).success).toBe(false);
    expect(state.writes).toEqual([]);
  });
});

describe("saving a team quick reply", () => {
  beforeEach(() => { state.role = "director"; state.writes = []; });

  it("refuses a variable the composer cannot fill and a broker, before writing", async () => {
    expect(await saveTeamQuickReplyAction({ name: "Carência", shortcut: "carencia", content: "Oi {{resumo}}" })).toEqual({ success: false, error: expect.stringContaining("{{resumo}}") });
    expect((await saveTeamQuickReplyAction({ name: "C", content: "Olá, tudo bem?" })).success).toBe(false);
    state.role = "broker";
    expect((await saveTeamQuickReplyAction({ name: "Carência", content: "Olá, {{primeiro_nome}}!" })).success).toBe(false);
    expect(state.writes).toEqual([]);
  });

  it("does not list replies for a role without access to conversations", async () => {
    state.role = "viewer";
    expect((await listTeamQuickRepliesAction()).success).toBe(false);
  });
});
