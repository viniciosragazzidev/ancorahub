import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ value: null as string | null, key: "" }));

vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({
  getSystemSetting: async (key: string) => { mocked.key = key; return mocked.value; },
}));

import { dutyShiftReminderSettingKey, isDutyShiftReminderEnabled } from "./duty-shift-reminder-flag";

describe("chave por tenant do lembrete do plantão", () => {
  beforeEach(() => { mocked.value = null; mocked.key = ""; });

  it("usa a chave exigida e mantém o lembrete desligado por padrão", async () => {
    expect(dutyShiftReminderSettingKey("tenant-a")).toBe("feature_duty_reminder_24h_tenant-a");
    expect(await isDutyShiftReminderEnabled("tenant-a")).toBe(false);
    expect(mocked.key).toBe("feature_duty_reminder_24h_tenant-a");
  });

  it("só habilita quando o Super-admin grava true", async () => {
    mocked.value = "true";
    expect(await isDutyShiftReminderEnabled("tenant-a")).toBe(true);
    mocked.value = "false";
    expect(await isDutyShiftReminderEnabled("tenant-a")).toBe(false);
  });
});
