import { describe, expect, it, vi } from "vitest";
import type { TenantContext } from "@/shared/auth/types";

// Mock next/headers
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "ancora_experience_mode" ? { value: "LIGHT" } : undefined),
    set: vi.fn(),
  }),
}));

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { getExperienceMode } from "./experience-mode";

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
});
