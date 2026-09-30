import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAdmin, setSetting, insertAudit } = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  setSetting: vi.fn(),
  insertAudit: vi.fn(),
}));

vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin: getAdmin }));
vi.mock("@/features/system-settings/queries", () => ({ setSystemSetting: setSetting, getSystemSetting: vi.fn(), getFeatureFlag: vi.fn() }));
vi.mock("@/shared/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/db")>();
  return {
    ...actual,
    getDatabase: () => ({ insert: () => ({ values: insertAudit }) }),
  };
});

import { updateColdLeadReactivationSettingsAction } from "./actions";

describe("Super Admin cold-lead reactivation control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdmin.mockResolvedValue({ userId: "platform-admin-1" });
    setSetting.mockResolvedValue(undefined);
    insertAudit.mockResolvedValue(undefined);
  });

  it("persists the kill switch and audits the global change", async () => {
    const form = new FormData();
    form.set("coldLeadReactivationEnabled", "true");

    await updateColdLeadReactivationSettingsAction(form);

    expect(setSetting).toHaveBeenCalledWith("feature_cold_lead_reactivation_enabled", "true", expect.any(Date));
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "platform-admin-1",
      action: "cold_lead_reactivation.settings_updated",
      targetId: "feature_cold_lead_reactivation_enabled",
      metadata: { enabled: true },
    }));
  });
});
