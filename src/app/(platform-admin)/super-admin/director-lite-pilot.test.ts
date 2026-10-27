import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdmin, setSetting, insertAudit, revalidatePath } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  setSetting: vi.fn(),
  insertAudit: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin: getAdmin }));
vi.mock("@/features/system-settings/queries", () => ({ setSystemSetting: setSetting, getSystemSetting: vi.fn(), getFeatureFlag: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return {
    ...actual,
    getDatabase: () => ({
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: "123e4567-e89b-42d3-a456-426614174000" }] }) }) }),
      insert: () => ({ values: insertAudit }),
    }),
  };
});

import { updateDirectorLiteStylePilotAction, updateLiveStatusPilotAction } from "./actions";

describe("piloto do visual Lite do Diretor no Super-admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdmin.mockResolvedValue({ userId: "platform-admin-1" });
    setSetting.mockResolvedValue(undefined);
    insertAudit.mockResolvedValue(undefined);
  });

  it("salva a chave da empresa, registra auditoria e revalida a ficha", async () => {
    const tenantId = "123e4567-e89b-42d3-a456-426614174000";
    const form = new FormData();
    form.set("enabled", "true");

    await updateDirectorLiteStylePilotAction(tenantId, form);

    expect(setSetting).toHaveBeenCalledWith("feature_director_lite_style_123e4567-e89b-42d3-a456-426614174000", "true", expect.any(Date));
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "platform-admin-1",
      action: "director_lite_style.tenant_pilot_updated",
      targetType: "tenant",
      targetId: tenantId,
      metadata: { enabled: true },
    }));
    expect(revalidatePath).toHaveBeenCalledWith(`/super-admin/tenants/${tenantId}`);
  });

  it("recusa valores de entrada fora do contrato", async () => {
    const form = new FormData();
    form.set("enabled", "yes");
    await expect(updateDirectorLiteStylePilotAction("123e4567-e89b-42d3-a456-426614174000", form)).rejects.toThrow();
    expect(setSetting).not.toHaveBeenCalled();
  });
});

describe("status vivos por empresa no Super-admin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdmin.mockResolvedValue({ userId: "platform-admin-1" });
    setSetting.mockResolvedValue(undefined);
    insertAudit.mockResolvedValue(undefined);
  });

  it("liga a faixa só da empresa, com auditoria", async () => {
    const tenantId = "123e4567-e89b-42d3-a456-426614174000";
    const form = new FormData();
    form.set("enabled", "false");
    await updateLiveStatusPilotAction(tenantId, form);
    expect(setSetting).toHaveBeenCalledWith(`feature_live_status_strip_${tenantId}`, "false", expect.any(Date));
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "live_status_strip.tenant_pilot_updated", targetId: tenantId, metadata: { enabled: false } }));
  });

  it("recusa valor fora do contrato", async () => {
    const form = new FormData();
    form.set("enabled", "sim");
    await expect(updateLiveStatusPilotAction("123e4567-e89b-42d3-a456-426614174000", form)).rejects.toThrow();
    expect(setSetting).not.toHaveBeenCalled();
  });
});
