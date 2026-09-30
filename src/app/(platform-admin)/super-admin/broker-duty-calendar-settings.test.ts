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
  return {
    ...actual,
    getDatabase: () => ({ insert: () => ({ values: insertAudit }) }),
  };
});

import {
  updateBrokerDutyCalendarEnabledSettingsAction,
  updateBrokerDutyCalendarHorizonSettingsAction,
} from "./actions";

describe("Super Admin Corretor Lite duty calendar controls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdmin.mockResolvedValue({ userId: "platform-admin-1" });
    setSetting.mockResolvedValue(undefined);
    insertAudit.mockResolvedValue(undefined);
  });

  it("persists and audits the reversible global feature switch", async () => {
    const form = new FormData();
    form.set("brokerDutyCalendarEnabled", "false");

    await updateBrokerDutyCalendarEnabledSettingsAction(form);

    expect(setSetting).toHaveBeenCalledWith("feature_broker_lite_duty_calendar_enabled", "false", expect.any(Date));
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "platform-admin-1",
      action: "broker_lite_duty_calendar.enabled_updated",
      targetId: "feature_broker_lite_duty_calendar_enabled",
      metadata: { enabled: false },
    }));
  });

  it("accepts only configured horizon values and audits the selection", async () => {
    const form = new FormData();
    form.set("brokerDutyCalendarHorizonMonths", "6");

    await updateBrokerDutyCalendarHorizonSettingsAction(form);

    expect(setSetting).toHaveBeenCalledWith("feature_broker_lite_duty_calendar_horizon_months", "6", expect.any(Date));
    expect(insertAudit).toHaveBeenCalledWith(expect.objectContaining({
      actorUserId: "platform-admin-1",
      action: "broker_lite_duty_calendar.horizon_updated",
      targetId: "feature_broker_lite_duty_calendar_horizon_months",
      metadata: { horizonMonths: 6 },
    }));
  });

  it("rejects a horizon outside the supported options", async () => {
    const form = new FormData();
    form.set("brokerDutyCalendarHorizonMonths", "2");

    await expect(updateBrokerDutyCalendarHorizonSettingsAction(form)).rejects.toThrow("Escolha um horizonte válido");
    expect(setSetting).not.toHaveBeenCalled();
    expect(insertAudit).not.toHaveBeenCalled();
  });
});
