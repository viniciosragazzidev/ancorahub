import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { getSetting } = vi.hoisted(() => ({
  getSetting: vi.fn<() => Promise<string | undefined>>(),
}));
vi.mock("@/features/system-settings/queries", () => ({ getSystemSetting: getSetting }));

describe("public interface motion preference", () => {
  it.each([
    [undefined, true],
    ["true", true],
    ["false", false],
    ["invalid", false],
  ] as const)("exposes only the presentation boolean for %s", async (stored, enabled) => {
    getSetting.mockResolvedValueOnce(stored);
    const response = await GET();
    expect(await response.json()).toEqual({ enabled });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(getSetting).toHaveBeenLastCalledWith("feature_interface_motion_enabled");
  });
  it("returns a static fallback without leaking database errors", async () => {
    getSetting.mockRejectedValueOnce(new Error("database-private-detail"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ enabled: false });
  });
});
