import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

vi.mock("./experience-mode", () => ({ getExperienceMode: vi.fn(async () => "LIGHT") }));
vi.mock("@/features/system-settings/queries", () => ({ FEATURE_FLAGS: { MANAGER_LITE: "manager-lite" }, getFeatureFlag: vi.fn(async () => "true") }));

import { getLiteAudience } from "./lite-audience";

describe("Lite audience", () => {
  it("o gestor nunca entra no Lite, nem com a chave do Lite do gestor ligada (versão antiga, 10/11)", async () => {
    const context: TenantContext = { userId: "manager-1", tenantId: "tenant-1", role: "manager", jobTitle: "manager", branchId: "branch-1" };
    await expect(getLiteAudience(context)).resolves.toBeNull();
  });
});
