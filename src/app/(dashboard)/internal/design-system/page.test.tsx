import { beforeEach, describe, expect, it, vi } from "vitest";

const access = vi.hoisted(() => ({
  tenant: null as { role: string } | null,
  platformAdmin: false,
}));

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
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
vi.mock("./primitives-catalog", () => ({ default: () => "CATALOG" }));

import DesignSystemCatalogPage from "./page";

beforeEach(() => {
  access.tenant = null;
  access.platformAdmin = false;
});

describe("catálogo das primitivas: acesso", () => {
  it("abre para diretor", async () => {
    access.tenant = { role: "director" };
    expect(await DesignSystemCatalogPage()).toBeTruthy();
  });

  it("abre para super admin", async () => {
    access.tenant = { role: "broker" };
    access.platformAdmin = true;
    expect(await DesignSystemCatalogPage()).toBeTruthy();
  });

  it.each(["broker", "manager", "supervisor"])("oculta para %s", async (role) => {
    access.tenant = { role };
    await expect(DesignSystemCatalogPage()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
