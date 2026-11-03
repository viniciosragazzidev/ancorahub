import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const state = vi.hoisted(() => ({
  select: vi.fn(), update: vi.fn(), insert: vi.fn(), values: vi.fn(), set: vi.fn(), where: vi.fn(),
  returning: vi.fn(), transaction: vi.fn(), context: vi.fn(), rows: [] as unknown[],
}));
vi.mock("@/shared/db", async () => ({ schema: await import("@/shared/db/schema"), getDatabase: () => state }));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: state.context }));
import {
  authenticateExtensionRequest, createExtensionAuthorizationCode, exchangeExtensionCode, getExtensionExchangePrincipal,
  renewExtensionSession, revokeExtensionSession, touchExtensionSession, type ExtensionPrincipal,
  SESSION_MAX_MS, SESSION_IDLE_MS, SESSION_TOUCH_MS,
} from "./auth";
import { recordExtensionAudit } from "./audit";

const now = new Date("2026-11-03T12:00:00Z");
const token = "session-token";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const principal = (): ExtensionPrincipal => ({ id: "session-a", tokenHash: hash(token), userId: "user-a", tenantId: "tenant-a",
  deviceId: "device-a", extensionVersion: "0.1.2", permissions: ["VIEW_LEAD"],
  createdAt: new Date(now.getTime() - 20 * 86_400_000), expiresAt: new Date(now.getTime() + 10 * 86_400_000),
  lastSeenAt: new Date(now.getTime() - 60_000), revokedAt: null });
const request = () => new Request("https://crm.test/api/extension/session", { headers: { Authorization: "Bearer " + token } });
const binding = { extensionId: "a".repeat(32), deviceId: "device-a" };
const input = { ...binding, code: "c".repeat(40), extensionVersion: "0.1.2" };
const grant = () => ({ id: "grant-a", userId: "user-a", tenantId: "tenant-a", extensionId: binding.extensionId,
  codeHash: hash(JSON.stringify([input.code, binding.extensionId, binding.deviceId])),
  expiresAt: new Date(now.getTime() + 300_000), usedAt: null, createdAt: now });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers(); vi.setSystemTime(now);
  state.rows = [principal()];
  state.select.mockImplementation(() => ({ from: () => ({ where: (condition: unknown) => {
    state.where(condition); return { limit: async () => state.rows };
  } }) }));
  state.update.mockReturnValue({ set: state.set });
  state.set.mockReturnValue({ where: state.where });
  state.where.mockReturnValue({ returning: state.returning });
  state.returning.mockResolvedValue([{ id: "claimed" }]);
  state.insert.mockReturnValue({ values: state.values });
  state.values.mockResolvedValue(undefined);
  state.transaction.mockImplementation(async (work: (tx: typeof state) => Promise<unknown>) => work(state));
  state.context.mockResolvedValue({ userId: "user-a", tenantId: "tenant-a", branchId: "branch-a", role: "broker" });
});
afterEach(() => vi.useRealTimers());

describe("sessões limitadas, tokens e códigos, somente mocks", () => {
  it.each(["idle", "expired", "cap", "revoked"])("nega sessão %s sem atualizar lastSeenAt", async (reason) => {
    const row = principal();
    if (reason === "idle") row.lastSeenAt = new Date(now.getTime() - SESSION_IDLE_MS);
    if (reason === "expired") row.expiresAt = now;
    if (reason === "cap") row.createdAt = new Date(now.getTime() - SESSION_MAX_MS);
    if (reason === "revoked") row.revokedAt = now;
    state.rows = [row];
    await expect(authenticateExtensionRequest(request())).rejects.toThrow();
    expect(state.update).not.toHaveBeenCalled();
  });

  it("aceita uso recente e não grava lastSeenAt em todo polling", async () => {
    const row = await authenticateExtensionRequest(request());
    await touchExtensionSession(row);
    row.lastSeenAt = new Date(now.getTime() - SESSION_TOUCH_MS);
    await touchExtensionSession(row);
    expect(state.update).not.toHaveBeenCalled();
    row.lastSeenAt = new Date(now.getTime() - SESSION_TOUCH_MS - 1);
    await touchExtensionSession(row);
    expect(state.set).toHaveBeenCalledWith({ lastSeenAt: now });
    const sql = new PgDialect().sqlToQuery(state.where.mock.calls.at(-1)![0]);
    expect(sql.sql).toContain('"tenant_id"');
    expect(sql.params).toContain("tenant-a");
    expect(sql.params).toContain(row.tokenHash);
  });

  it("renova com compare-and-swap, troca o hash e mantém expiresAt e lastSeenAt", async () => {
    const row = principal();
    const result = await renewExtensionSession(row);
    expect(result.token).not.toBe(token);
    expect(result.session.expiresAt).toBe(row.expiresAt.toISOString());
    expect(state.set).toHaveBeenCalledWith({ tokenHash: hash(result.token) });
    const sql = new PgDialect().sqlToQuery(state.where.mock.calls.at(-1)![0]);
    expect(sql.params).toContain(row.tokenHash);
    expect(sql.params).toContain(row.tenantId);
    expect(state.values).toHaveBeenCalledWith(expect.objectContaining({ acao: "extension.session.renewed" }));
  });

  it("uma segunda renovação com token já consumido falha sem auditoria de sucesso", async () => {
    state.returning.mockResolvedValue([]);
    await expect(renewExtensionSession(principal())).rejects.toThrow();
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("aceita o token trocado por 60 s, sem estender expiresAt, e recusa depois da janela", async () => {
    await renewExtensionSession(principal());
    const atual = { ...principal(), tokenHash: "hash-novo" };
    // Primeira consulta (token atual) não acha nada; a segunda (sessão dona do token trocado) acha a sessão.
    let consulta = 0;
    state.select.mockImplementation(() => ({ from: () => ({ where: (condition: unknown) => {
      state.where(condition); consulta += 1;
      return { limit: async () => (consulta === 1 ? [] : [atual]) };
    } }) }));
    const dentro = await authenticateExtensionRequest(request());
    expect(dentro.id).toBe("session-a");
    expect(dentro.expiresAt).toBe(atual.expiresAt);

    vi.setSystemTime(new Date(now.getTime() + 60_000));
    consulta = 0;
    await expect(authenticateExtensionRequest(request())).rejects.toThrow();
  });

  it("vincula extensionId e deviceId ao hash sem salvar o código bruto", async () => {
    const code = await createExtensionAuthorizationCode(binding);
    expect(state.values).toHaveBeenCalledWith(expect.objectContaining({ extensionId: binding.extensionId,
      codeHash: hash(JSON.stringify([code, binding.extensionId, binding.deviceId])) }));
    expect(JSON.stringify(state.values.mock.calls)).not.toContain(code);
  });

  it.each(["extension", "device", "missing-extension"])("recusa código vinculado a outro %s", async (wrong) => {
    state.rows = [grant()];
    const candidate = { ...input, ...(wrong === "extension" ? { extensionId: "b".repeat(32) } : {}),
      ...(wrong === "device" ? { deviceId: "device-b" } : {}), ...(wrong === "missing-extension" ? { extensionId: undefined } : {}) };
    await expect(getExtensionExchangePrincipal(candidate)).rejects.toThrow();
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("aceita somente o par correto e mantém o plano B legado sem amarração", async () => {
    state.rows = [grant()];
    expect((await getExtensionExchangePrincipal(input)).session.deviceId).toBe(binding.deviceId);
    state.rows = [{ ...grant(), extensionId: null, codeHash: hash(input.code) }];
    expect((await getExtensionExchangePrincipal({ ...input, extensionId: undefined })).grant.extensionId).toBeNull();
  });

  it("consome o código atomicamente e impede emissão dupla", async () => {
    const result = await exchangeExtensionCode(input, grant());
    expect(result.session.tenantId).toBe("tenant-a");
    expect(state.values).toHaveBeenCalledWith(expect.objectContaining({ tokenHash: hash(result.token) }));
    state.insert.mockClear(); state.returning.mockResolvedValue([]);
    await expect(exchangeExtensionCode(input, grant())).rejects.toThrow();
    expect(state.insert).not.toHaveBeenCalled();
  });

  it("revoga somente a sessão autenticada no tenant e audita identidade confiável", async () => {
    await revokeExtensionSession(principal());
    const sql = new PgDialect().sqlToQuery(state.where.mock.calls.at(-1)![0]);
    expect(sql.params).toContain("tenant-a");
    expect(sql.params).toContain("session-a");
    await recordExtensionAudit("extension.lead.resolve", principal(), { leadId: "lead-a", metadata: { source: "forged", tenantId: "tenant-b" } });
    expect(state.values).toHaveBeenLastCalledWith(expect.objectContaining({ acao: "extension.lead.resolve", metadata: {
      source: "extension", tenantId: "tenant-a", sessionId: "session-a", deviceId: "device-a", extensionVersion: "0.1.2",
    } }));
  });
});
