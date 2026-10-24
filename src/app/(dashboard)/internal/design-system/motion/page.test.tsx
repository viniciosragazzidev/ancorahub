import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  tenant: null as { role: string } | null,
  platformAdmin: false,
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/shared/auth/tenant-context", () => ({
  getRequiredTenantContext: async () => {
    if (!access.tenant) throw new Error("no session");
    return access.tenant;
  },
}));
vi.mock("@/shared/auth/platform-admin", () => ({
  getRequiredPlatformAdmin: async () => {
    if (!access.platformAdmin) throw new Error("not admin");
    return { userId: "admin", email: "admin@example.com" };
  },
}));
vi.mock("./motion-playground", () => ({ default: () => "PLAYGROUND" }));

import MotionCatalogPage from "./page";

beforeEach(() => {
  access.tenant = null;
  access.platformAdmin = false;
});

describe("catálogo de movimento: acesso", () => {
  it("opens for the director of the company", async () => {
    access.tenant = { role: "director" };
    expect(await MotionCatalogPage()).toBeTruthy();
  });

  it("opens for a platform super admin", async () => {
    access.tenant = { role: "broker" };
    access.platformAdmin = true;
    expect(await MotionCatalogPage()).toBeTruthy();
  });

  it("answers not found for a broker, manager or supervisor", async () => {
    access.tenant = { role: "manager" };
    await expect(MotionCatalogPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("answers not found for an anonymous request", async () => {
    await expect(MotionCatalogPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
