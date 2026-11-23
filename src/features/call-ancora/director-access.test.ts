import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

const mocks = vi.hoisted(() => ({
  context: null as unknown as TenantContext,
  platformAdmin: false,
}));

vi.mock("@/shared/auth/tenant-context", () => ({ getRequiredTenantContext: vi.fn(async () => mocks.context) }));
vi.mock("@/shared/auth/session", () => ({ getRequiredSession: vi.fn(async () => ({ user: { id: "user-1" } })) }));
vi.mock("@/features/super-admin/view-as", () => ({ isActivePlatformAdmin: vi.fn(async () => mocks.platformAdmin) }));

import { requireCallAncoraDirectorAccess } from "./director-access";

function contextFor(role: TenantContext["role"]): TenantContext {
  return { userId: "user-1", tenantId: "tenant-1", role, jobTitle: role, branchId: null };
}

beforeEach(() => { mocks.platformAdmin = false; });
afterEach(() => { vi.unstubAllEnvs(); });

describe("área do diretor do Call Âncora", () => {
  it("em produção recusa corretor, supervisor e gestor", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const role of ["broker", "supervisor", "manager"] as const) {
      mocks.context = contextFor(role);
      await expect(requireCallAncoraDirectorAccess()).resolves.toBeNull();
    }
  });

  it("em produção libera o diretor e o admin ativo da plataforma", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.context = contextFor("director");
    await expect(requireCallAncoraDirectorAccess()).resolves.toBe(mocks.context);
    mocks.context = contextFor("broker");
    mocks.platformAdmin = true;
    await expect(requireCallAncoraDirectorAccess()).resolves.toBe(mocks.context);
  });

  it("o atalho de desenvolvimento só vale com NODE_ENV=development (next dev)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.context = contextFor("broker");
    await expect(requireCallAncoraDirectorAccess()).resolves.toBe(mocks.context);
  });
});
