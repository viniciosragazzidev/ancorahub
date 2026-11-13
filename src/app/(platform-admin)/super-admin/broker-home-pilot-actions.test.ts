import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  admin: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  upsert: vi.fn(),
  invalidate: vi.fn(),
  revalidate: vi.fn(),
  selections: [] as Record<string, unknown>[][],
}));
vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin: mocks.admin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/features/system-settings/queries", () => ({
  invalidateSystemSettingsCache: mocks.invalidate,
}));
vi.mock("@/features/broker-workspace/home-pilot-settings", () => ({
  brokerHomePilotSettingKey: (id: string) => `feature_broker_home_v2_${id}`,
}));
vi.mock("@/shared/db", () => ({
  getDatabase: () => ({ transaction: mocks.transaction }),
  schema: {
    tenants: { id: "tenantId" },
    tenantMemberships: { tenantId: "tenantId", role: "role", status: "status", userId: "userId" },
    systemSettings: { key: "key" },
    platformAuditLogs: {},
  },
}));
import { updateBrokerHomePilotAction } from "./broker-home-pilot-actions";
const tenant = "00000000-0000-4000-8000-000000000001";
const user = "00000000-0000-4000-8000-000000000002";
const form = () => {
  const data = new FormData();
  data.set("enabled", "true");
  data.set("showLearning", "true");
  data.append("brokerIds", user);
  return data;
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.selections = [[{ id: tenant }], [{ userId: user }], []];
  mocks.admin.mockResolvedValue({ userId: "admin" });
  mocks.values.mockReturnValue({ onConflictDoUpdate: mocks.upsert });
  mocks.insert.mockReturnValue({ values: mocks.values });
  mocks.transaction.mockImplementation(async (run: (tx: object) => Promise<void>) =>
    run({
      select: () => ({
        from: () => ({
          where: () => {
            const result = mocks.selections.shift() ?? [];
            return {
              limit: async () => result,
              then: (resolve: (rows: Record<string, unknown>[]) => void) => resolve(result),
            };
          },
        }),
      }),
      insert: mocks.insert,
    }),
  );
});
describe("administração do piloto da Home", () => {
  it("exige Super-admin antes de consultar ou alterar dados", async () => {
    mocks.admin.mockRejectedValue(new Error("Sem acesso"));
    await expect(updateBrokerHomePilotAction(tenant, form())).rejects.toThrow("Sem acesso");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("salva configuração e auditoria na mesma transação", async () => {
    await updateBrokerHomePilotAction(tenant, form());
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({ key: `feature_broker_home_v2_${tenant}` }),
    );
    expect(mocks.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin",
        action: "broker_home.tenant_pilot_updated",
        targetId: tenant,
        metadata: expect.objectContaining({
          next: { enabled: true, brokerIds: [user], showLearning: true },
        }),
      }),
    );
    expect(mocks.invalidate).toHaveBeenCalledOnce();
  });
  it("rejeita corretor fora da empresa ou inativo antes de escrever", async () => {
    mocks.selections = [[{ id: tenant }], []];
    await expect(updateBrokerHomePilotAction(tenant, form())).rejects.toThrow(
      "Selecione somente corretores ativos",
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("rejeita piloto ativo sem participantes e entrada malformada", async () => {
    const empty = form();
    empty.delete("brokerIds");
    await expect(updateBrokerHomePilotAction(tenant, empty)).rejects.toThrow(
      "pelo menos um corretor",
    );
    const invalid = form();
    invalid.set("enabled", "yes");
    await expect(updateBrokerHomePilotAction(tenant, invalid)).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
