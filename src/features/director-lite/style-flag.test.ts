import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSystemSetting } = vi.hoisted(() => ({ getSystemSetting: vi.fn() }));

vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting }));

import { directorLiteStyleSettingKey, isDirectorLiteStyleEnabled, shouldUseDirectorLiteStyle } from "./style-flag";
import { isDirectorLiteRouteOptedOut } from "@/components/arc/director-lite-routes";

describe("director Lite style flag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the per-company settings key and stays off when unset", async () => {
    getSystemSetting.mockResolvedValue(undefined);

    await expect(isDirectorLiteStyleEnabled("tenant-1")).resolves.toBe(false);
    expect(directorLiteStyleSettingKey("tenant-1")).toBe("feature_director_lite_style_tenant-1");
    expect(getSystemSetting).toHaveBeenCalledWith("feature_director_lite_style_tenant-1");
  });

  it("enables only the director when the tenant pilot is active", async () => {
    getSystemSetting.mockResolvedValue("true");

    await expect(shouldUseDirectorLiteStyle("director", "tenant-1")).resolves.toBe(true);
    await expect(shouldUseDirectorLiteStyle("manager", "tenant-1")).resolves.toBe(false);
    await expect(shouldUseDirectorLiteStyle("supervisor", "tenant-1")).resolves.toBe(false);
    expect(getSystemSetting).toHaveBeenCalledTimes(1);
  });

  it("keeps the director's light theme active on routes whose page skin is opted out", async () => {
    getSystemSetting.mockResolvedValue("true");
    const route = "/atendimento";

    expect(isDirectorLiteRouteOptedOut(route)).toBe(true);
    await expect(shouldUseDirectorLiteStyle("director", "tenant-1")).resolves.toBe(true);
  });

  it("fails closed when the setting cannot be read", async () => {
    getSystemSetting.mockRejectedValue(new Error("settings unavailable"));

    await expect(shouldUseDirectorLiteStyle("director", "tenant-1")).resolves.toBe(false);
  });
});
