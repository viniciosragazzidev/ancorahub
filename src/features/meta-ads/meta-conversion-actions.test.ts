import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  context: vi.fn(),
  list: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: mocks.context }));
vi.mock("./meta-conversion-service", () => ({
  getMetaConversionsPanel: vi.fn(),
  saveMetaConversionSettings: vi.fn(),
  listMetaConversionRefusals: mocks.list,
  retryMetaConversionRefusals: mocks.retry,
}));

import { listMetaConversionRefusalsAction, retryMetaConversionRefusalsAction } from "./meta-conversion-actions";

const director = { role: "director", tenantId: "tenant-a", userId: "user-1" };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.context.mockResolvedValue(director);
});

describe("recusas da Meta: escopo", () => {
  it("só o Diretor vê e reenvia", async () => {
    for (const role of ["manager", "supervisor", "broker"]) {
      mocks.context.mockResolvedValue({ ...director, role });
      expect((await listMetaConversionRefusalsAction()).success).toBe(false);
      expect((await retryMetaConversionRefusalsAction({ all: true })).success).toBe(false);
    }
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.retry).not.toHaveBeenCalled();
  });

  it("lista e reenvia sempre na empresa do usuário, nunca na que vier do cliente", async () => {
    mocks.list.mockResolvedValue([]);
    mocks.retry.mockResolvedValue({ requeued: 1, refused: [] });
    await listMetaConversionRefusalsAction();
    await retryMetaConversionRefusalsAction({ id: "evt-1", tenantId: "tenant-b" } as unknown as { id: string });
    expect(mocks.list).toHaveBeenCalledWith({ tenantId: "tenant-a" });
    expect(mocks.retry).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-1", ids: ["evt-1"] });
  });

  it("tentar todos manda 'all' e devolve a contagem", async () => {
    mocks.retry.mockResolvedValue({ requeued: 3, refused: [{ id: "old", cause: "Passou da janela de 7 dias da Meta." }] });
    const result = await retryMetaConversionRefusalsAction({ all: true });
    expect(mocks.retry).toHaveBeenCalledWith({ tenantId: "tenant-a", userId: "user-1", ids: "all" });
    expect(result).toEqual({ success: true, requeued: 3, refused: [{ id: "old", cause: "Passou da janela de 7 dias da Meta." }] });
  });

  it("uma etapa fora da janela volta como erro com a causa", async () => {
    mocks.retry.mockResolvedValue({ requeued: 0, refused: [{ id: "evt-1", cause: "Passou da janela de 7 dias da Meta. Esta etapa não pode mais ser enviada." }] });
    const result = await retryMetaConversionRefusalsAction({ id: "evt-1" });
    expect(result).toEqual({ success: false, error: "Passou da janela de 7 dias da Meta. Esta etapa não pode mais ser enviada." });
  });

  it("id vazio não chega ao serviço; falha do banco vira causa legível", async () => {
    expect((await retryMetaConversionRefusalsAction({ id: "  " })).success).toBe(false);
    expect(mocks.retry).not.toHaveBeenCalled();
    mocks.retry.mockRejectedValue(new Error("connection refused"));
    expect(await retryMetaConversionRefusalsAction({ id: "evt-1" })).toEqual({ success: false, error: "Não foi possível devolver para a fila agora." });
  });
});
