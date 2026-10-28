import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), setting: vi.fn(), flag: vi.fn(), audit: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/shared/auth/platform-admin", () => ({ getRequiredPlatformAdmin: mocks.admin }));
vi.mock("@/features/system-settings/queries", () => ({ getFeatureFlag: mocks.flag, setSystemSetting: mocks.setting }));
vi.mock("@/shared/db", () => ({ getDatabase: () => ({ insert: () => ({ values: mocks.audit }) }), schema: { platformAuditLogs: "platform_audit_logs" } }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));

import { updateContextualIllustrationsAction } from "./illustration-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.admin.mockResolvedValue({ userId: "admin-fixture" });
  mocks.flag.mockResolvedValue("true");
  mocks.setting.mockResolvedValue(undefined);
  mocks.audit.mockResolvedValue(undefined);
});

describe("illustrations control", () => {
  it("rejects users without platform authority before any mutation", async () => {
    mocks.admin.mockRejectedValue(new Error("Forbidden"));
    await expect(updateContextualIllustrationsAction(new FormData())).rejects.toThrow("Forbidden");
    expect(mocks.setting).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("rejects malformed external input", async () => {
    const form = new FormData();
    form.set("contextualIllustrationsEnabled", "anything");
    await expect(updateContextualIllustrationsAction(form)).rejects.toThrow();
    expect(mocks.setting).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each([true, false])("persists and audits enabled=%s, including an unchecked control", async (enabled) => {
    const form = new FormData();
    if (enabled) form.set("contextualIllustrationsEnabled", "true");
    await updateContextualIllustrationsAction(form);
    expect(mocks.setting).toHaveBeenCalledWith("feature_ui_contextual_illustrations", String(enabled), expect.any(Date));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "admin-fixture", action: "contextual_illustrations.settings_updated",
      metadata: { enabled: String(enabled), previousEnabled: "true", scope: "global" },
    }));
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
});
