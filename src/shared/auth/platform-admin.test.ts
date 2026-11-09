import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/shared/db", () => ({ getDatabase: vi.fn(), schema: {} }));
vi.mock("./session", () => ({ getRequiredSession: vi.fn() }));

import { isPlatformAdmin2faRequired } from "./platform-admin";

describe("platform admin 2FA switch", () => {
  it("is off until PLATFORM_ADMIN_REQUIRE_2FA=true, so a deploy never locks the admin out", () => {
    expect(isPlatformAdmin2faRequired({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(isPlatformAdmin2faRequired({ PLATFORM_ADMIN_REQUIRE_2FA: "true" } as unknown as NodeJS.ProcessEnv)).toBe(true);
  });
});
