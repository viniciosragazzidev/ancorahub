import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  contexto: { userId: "corretor-1", tenantId: "empresa-1", role: "broker", branchId: "unidade-1" },
  revogadas: [] as Array<{ id: string; userId: string; tenantId: string; deviceId: string; extensionVersion: string }>,
  auditorias: [] as Array<{ userId: string; entidadeId: string; acao: string; metadata: Record<string, unknown> }>,
  falharAuditoria: false,
  piloto: true,
  criarCodigo: vi.fn(async () => ({ code: "codigo-falso-1234", expiresInSeconds: 300 })),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: async () => state.contexto }));
vi.mock("@/shared/auth/authorization", () => ({ requireAnyRole: (context: unknown) => context }));
vi.mock("./actions", () => ({ createExtensionCodeAction: state.criarCodigo }));
vi.mock("./pilot", () => ({ isExtensionPilotUser: async () => state.piloto }));
vi.mock("@/shared/db", async () => ({
  schema: await import("@/shared/db/schema"),
  getDatabase: () => ({
    transaction: async (fn: (tx: unknown) => Promise<void>) => fn({
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => state.revogadas,
          }),
        }),
      }),
      insert: () => ({
        values: async (valor: { userId: string; entidadeId: string; acao: string; metadata: Record<string, unknown> }) => {
          if (state.falharAuditoria) throw new Error("falha simulada da auditoria");
          state.auditorias.push(valor);
        },
      }),
    }),
  }),
}));

import { desconectarExtensaoAction, gerarCodigoConexaoAction } from "./conexao-actions";

const APARELHO_A = { id: "sessao-a", userId: "corretor-1", tenantId: "empresa-1", deviceId: "aparelho-aaaa-1111", extensionVersion: "0.1.2" };
const APARELHO_B = { id: "sessao-b", userId: "corretor-1", tenantId: "empresa-1", deviceId: "aparelho-bbbb-2222", extensionVersion: "0.2.0" };

describe("desconectar pelo CRM", () => {
  beforeEach(() => {
    state.revogadas = [];
    state.auditorias = [];
    state.falharAuditoria = false;
  });

  it("audita cada aparelho revogado, com a origem e a identidade da sessão", async () => {
    state.revogadas = [APARELHO_A, APARELHO_B];
    await desconectarExtensaoAction();
    expect(state.auditorias).toHaveLength(2);
    expect(state.auditorias.map((linha) => linha.entidadeId)).toEqual(["sessao-a", "sessao-b"]);
    expect(state.auditorias[0]).toMatchObject({
      userId: "corretor-1",
      acao: "extension.session.revoked",
      metadata: { source: "extension", tenantId: "empresa-1", deviceId: "aparelho-aaaa-1111", sessionId: "sessao-a", extensionVersion: "0.1.2" },
    });
    expect(state.auditorias[1].metadata).toMatchObject({ deviceId: "aparelho-bbbb-2222", sessionId: "sessao-b", extensionVersion: "0.2.0" });
  });

  it("sem sessões ativas, não grava auditoria", async () => {
    await desconectarExtensaoAction();
    expect(state.auditorias).toHaveLength(0);
  });

  it("falha na auditoria propaga o erro: a transação não termina em silêncio", async () => {
    state.revogadas = [APARELHO_A];
    state.falharAuditoria = true;
    await expect(desconectarExtensaoAction()).rejects.toThrow("falha simulada da auditoria");
  });
});

describe("gerar código de conexão amarrado", () => {
  beforeEach(() => {
    state.criarCodigo.mockClear();
    state.piloto = true;
  });

  it("piloto desligado para o corretor: não cria código e não diz que existe piloto", async () => {
    state.piloto = false;
    await expect(gerarCodigoConexaoAction({ ext: "abcdefghijklmnopabcdefghijklmnop", device: "1f2e3d4c-0000-4000-8000-000000000000" }))
      .rejects.toThrow("Extensão desativada.");
    expect(state.criarCodigo).not.toHaveBeenCalled();
  });

  it("chama a criação do código com extensão e aparelho, sem cast", async () => {
    const resultado = await gerarCodigoConexaoAction({ ext: "abcdefghijklmnopabcdefghijklmnop", device: "1f2e3d4c-0000-4000-8000-000000000000" });
    expect(state.criarCodigo).toHaveBeenCalledWith({
      extensionId: "abcdefghijklmnopabcdefghijklmnop",
      deviceId: "1f2e3d4c-0000-4000-8000-000000000000",
    });
    expect(resultado.code).toBe("codigo-falso-1234");
  });

  it("entrada inválida não cria código", async () => {
    await expect(gerarCodigoConexaoAction({ ext: "ABC", device: "não-uuid" })).rejects.toThrow();
    expect(state.criarCodigo).not.toHaveBeenCalled();
  });
});
