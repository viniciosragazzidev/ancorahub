import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

const state = vi.hoisted(() => ({ cookieMode: "LIGHT", managerFlag: "false", setCookie: vi.fn() }));

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "ancora_experience_mode" ? { value: state.cookieMode } : undefined),
    set: state.setCookie,
  }),
}));
vi.mock("@/features/system-settings/queries", () => ({
  FEATURE_FLAGS: { MANAGER_LITE: "manager-lite" },
  getFeatureFlag: vi.fn(async () => state.managerFlag),
}));
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: vi.fn(async () => ({ userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" })) }));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getExperienceMode, setExperienceModeAction } from "./experience-mode";

describe("getExperienceMode", () => {
  it("defaults to LIGHT when cookie is LIGHT", async () => {
    const context: TenantContext = {
      userId: "user-1",
      tenantId: "tenant-1",
      role: "broker",
      jobTitle: "broker",
      branchId: null,
    };
    const mode = await getExperienceMode(context);
    expect(mode).toBe("LIGHT");
  });

  it("forces a flagged manager to LIGHT before a NORMAL cookie or preference can win", async () => {
    state.managerFlag = "true";
    state.cookieMode = "NORMAL";
    const context: TenantContext = { userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" };
    expect(await getExperienceMode(context)).toBe("LIGHT");
  });

  it("keeps the normal preference available while the manager flag is off", async () => {
    state.managerFlag = "false";
    state.cookieMode = "NORMAL";
    const context: TenantContext = { userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" };
    expect(await getExperienceMode(context)).toBe("NORMAL");
  });

  it("rejects a manager request for NORMAL while the flag is on", async () => {
    state.managerFlag = "true";
    const result = await setExperienceModeAction("NORMAL");
    expect(result).toMatchObject({ success: false, mode: "LIGHT" });
    expect(state.setCookie).not.toHaveBeenCalled();
  });
});
