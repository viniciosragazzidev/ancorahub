import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetSystemSetting = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: mockGetSystemSetting }));

import { isTeamManagementEnabled, TEAM_MANAGEMENT_FLAG_KEY } from "./flag";

beforeEach(() => mockGetSystemSetting.mockReset());

describe("flag feature_team_management_enabled (criada no G0)", () => {
  it("reads the G0 key and is on only for the string true", async () => {
    mockGetSystemSetting.mockResolvedValue("true");
    await expect(isTeamManagementEnabled()).resolves.toBe(true);
    expect(mockGetSystemSetting).toHaveBeenCalledWith("feature_team_management_enabled");
    expect(TEAM_MANAGEMENT_FLAG_KEY).toBe("feature_team_management_enabled");
  });

  it("is off when unset or false", async () => {
    mockGetSystemSetting.mockResolvedValue(undefined);
    await expect(isTeamManagementEnabled()).resolves.toBe(false);
    mockGetSystemSetting.mockResolvedValue("false");
    await expect(isTeamManagementEnabled()).resolves.toBe(false);
  });
});
