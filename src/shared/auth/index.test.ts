import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("better-auth", () => ({ betterAuth: vi.fn() }));
vi.mock("better-auth/adapters/drizzle", () => ({ drizzleAdapter: vi.fn() }));
vi.mock("better-auth/next-js", () => ({ nextCookies: vi.fn() }));
vi.mock("better-auth/plugins", () => ({ twoFactor: vi.fn() }));
vi.mock("@better-auth/passkey", () => ({ passkey: vi.fn() }));

import { getTrustedAuthOrigins } from "./index";

describe("trusted auth origins", () => {
  const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.BETTER_AUTH_URL = originalBetterAuthUrl;
    process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
  });

  it("accepts the canonical CRM domain even while legacy configuration is present", () => {
    process.env.BETTER_AUTH_URL = "https://corretop.vercel.app";
    process.env.NEXT_PUBLIC_APP_URL = "https://corretop.vercel.app";

    expect(getTrustedAuthOrigins()).toContain("https://crm.ancorasaude.cloud");
    expect(getTrustedAuthOrigins()).toContain("https://corretop.vercel.app");
  });
});
