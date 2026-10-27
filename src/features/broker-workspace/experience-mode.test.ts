import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

const state = vi.hoisted(() => ({ cookieMode: "LIGHT", preferredMode: "NORMAL", role: "manager", managerFlag: "false", contextFailure: false, setCookie: vi.fn(), auditValues: vi.fn().mockResolvedValue(undefined) }));

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
vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: vi.fn(async () => {
  if (state.contextFailure) throw new Error("No tenant context");
  return { userId: "actor-test", tenantId: "tenant-1", role: state.role, jobTitle: state.role, branchId: "branch-1" };
}) }));
vi.mock("@/shared/db", async () => ({
  getDatabase: vi.fn(() => ({
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ preferredExperienceMode: state.preferredMode }] }) }) }),
    insert: () => ({ values: state.auditValues }),
  })),
  schema: await import("@/shared/db/schema"),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getExperienceMode, setExperienceModeAction } from "./experience-mode";
import { getDatabase } from "@/shared/db";

beforeEach(() => {
  state.cookieMode = "LIGHT";
  state.preferredMode = "NORMAL";
  state.role = "manager";
  state.managerFlag = "false";
  state.contextFailure = false;
  vi.clearAllMocks();
});

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

  it.each(["NORMAL", "LIGHT", ""])("forces a broker to LIGHT before cookie %s or persisted NORMAL", async (cookieMode) => {
    state.cookieMode = cookieMode;
    const context: TenantContext = { userId: "broker-test", tenantId: "tenant-1", role: "broker", jobTitle: "broker", branchId: null };
    expect(await getExperienceMode(context)).toBe("LIGHT");
    expect(getDatabase).not.toHaveBeenCalled();
  });

  it("uses the authenticated broker role when no context is passed explicitly", async () => {
    state.role = "broker";
    state.cookieMode = "NORMAL";
    expect(await getExperienceMode()).toBe("LIGHT");
  });

  it("keeps a platform admin viewing as a broker inside Lite", async () => {
    state.cookieMode = "NORMAL";
    const context: TenantContext = { userId: "broker-test", tenantId: "tenant-1", role: "broker", jobTitle: "broker", branchId: null, viewAs: { adminUserId: "admin-test" } };
    expect(await getExperienceMode(context)).toBe("LIGHT");
  });

  it("rejects a broker request for NORMAL without saving a normal cookie", async () => {
    state.role = "broker";
    expect(await setExperienceModeAction("NORMAL")).toMatchObject({ success: false, mode: "LIGHT", error: expect.stringContaining("corretores") });
    expect(state.setCookie).not.toHaveBeenCalled();
    expect(state.auditValues).toHaveBeenCalledWith(expect.objectContaining({
      userId: "actor-test", entidadeId: "tenant-1:actor-test", acao: "experience_mode.normal_blocked_broker",
    }));
  });

  it("keeps NORMAL blocked even when the audit database is unavailable", async () => {
    state.role = "broker";
    vi.mocked(getDatabase).mockImplementationOnce(() => { throw new Error("database unavailable"); });
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      expect(await setExperienceModeAction("NORMAL")).toMatchObject({ success: false, mode: "LIGHT" });
      expect(state.setCookie).not.toHaveBeenCalled();
      expect(warning).toHaveBeenCalledWith("[broker-workspace] normal_mode_blocked_audit_unavailable", { tenantId: "tenant-1" });
    } finally {
      warning.mockRestore();
    }
  });

  it("keeps the normal mode available to a director", async () => {
    state.cookieMode = "NORMAL";
    const context: TenantContext = { userId: "director-test", tenantId: "tenant-1", role: "director", jobTitle: "director", branchId: null };
    expect(await getExperienceMode(context)).toBe("NORMAL");
    state.cookieMode = "";
    expect(await getExperienceMode(context)).toBe("NORMAL");
  });

  it("allows a manager to request NORMAL while the manager Lite flag is off", async () => {
    expect(await setExperienceModeAction("NORMAL")).toMatchObject({ success: true, mode: "NORMAL" });
    expect(state.setCookie).toHaveBeenCalledWith("ancora_experience_mode", "NORMAL", expect.any(Object));
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

  it("does not let a NORMAL cookie choose the shell without a trusted identity", async () => {
    state.managerFlag = "false";
    state.contextFailure = true;
    state.cookieMode = "NORMAL";
    expect(await getExperienceMode()).toBe("LIGHT");
    state.contextFailure = false;
  });

  it("still forces a flagged manager to LIGHT when a NORMAL cookie is present", async () => {
    state.managerFlag = "true";
    state.contextFailure = false;
    state.cookieMode = "NORMAL";
    expect(await getExperienceMode()).toBe("LIGHT");
  });

  it("rejects a manager request for NORMAL while the flag is on", async () => {
    state.managerFlag = "true";
    const result = await setExperienceModeAction("NORMAL");
    expect(result).toMatchObject({ success: false, mode: "LIGHT" });
    expect(state.setCookie).not.toHaveBeenCalled();
  });
});
