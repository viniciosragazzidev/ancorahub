import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdmin, setSetting, insertAudit } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  setSetting: vi.fn(),
  insertAudit: vi.fn(),
}));

vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin: getAdmin }));
vi.mock("@/features/system-settings/queries", () => ({ setSystemSetting: setSetting }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return { ...actual, getDatabase: () => ({ insert: () => ({ values: insertAudit }) }) };
});

import { updateBrokerClientWalletLiteSettingsAction } from "./actions";

describe("controle global da carteira Lite do corretor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdmin.mockResolvedValue({ userId: "platform-admin-1" });
    setSetting.mockResolvedValue(undefined);
    insertAudit.mockResolvedValue(undefined);
  });

  it("salva o interruptor e registra auditoria", async () => {
    const form = new FormData();
    form.set("enabled", "true");

    await updateBrokerClientWalletLiteSettingsAction(form);

    expect(setSetting).toHaveBeenCalledWith("feature_broker_client_wallet_lite_enabled", "true", expect.any(Date));
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "platform-admin-1",
      action: "broker_client_wallet_lite.global_feature_updated",
      targetType: "system_settings",
      targetId: "feature_broker_client_wallet_lite_enabled",
      metadata: { enabled: true },
    }));
  });

  it("recusa valores fora do contrato", async () => {
    const form = new FormData();
    form.set("enabled", "sim");

    await expect(updateBrokerClientWalletLiteSettingsAction(form)).rejects.toThrow();
    expect(setSetting).not.toHaveBeenCalled();
    expect(insertAudit).not.toHaveBeenCalled();
  });
});
