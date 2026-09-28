import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const lookup = vi.hoisted(() => ({
  rows: [] as { userId: string; role: string | null; onboardingStatus: string | null }[],
  fails: false,
}));

vi.mock("drizzle-orm", () => ({ eq: () => true }));
vi.mock("@/shared/db/client", () => ({
  schema: {
    session: { userId: {}, token: {} },
    tenantMemberships: { role: {}, userId: {} },
    userOnboarding: { status: {}, userId: {} },
  },
  getDatabase: () => ({
    select: () => ({
      from: () => ({
        leftJoin: () => ({
          leftJoin: () => ({
            where: () => ({ limit: async () => {
              if (lookup.fails) throw new Error("database unavailable");
              return lookup.rows;
            } }),
          }),
        }),
      }),
    }),
  }),
}));
vi.mock("@/utils/supabase/middleware", () => ({
  updateSession: async (request: NextRequest) => NextResponse.next({ request: { headers: request.headers } }),
}));
vi.mock("@/shared/observability/middleware-timing", () => ({
  startMiddlewareTiming: () => ({}),
  endMiddlewareTiming: () => undefined,
  logMiddlewareSpan: () => undefined,
}));

import { createHmac } from "node:crypto";

import { proxy, readSessionToken } from "./proxy";

const SECRET = "test-better-auth-secret";

/** The cookie exactly as Better Auth sets it: encodeURIComponent(`${token}.${hmacBase64}`). */
function signed(token: string, secret = SECRET) {
  return encodeURIComponent(`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`);
}

function request(path: string, token = "revoked-token", cookieName = "better-auth.session_token") {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: { cookie: `${cookieName}=${token}` },
  });
}

describe("revoked Better Auth session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BETTER_AUTH_SECRET", SECRET);
    lookup.rows = [];
    lookup.fails = false;
  });

  it("does not bounce indefinitely between login and a protected route", async () => {
    const login = await proxy(request("/login"));
    expect(login.status).toBe(200);
    expect(login.headers.get("location")).toBeNull();
    expect(login.cookies.get("better-auth.session_token")?.value).toBe("");

    const dashboard = await proxy(request("/dashboard"));
    expect(dashboard.status).toBe(307);
    expect(dashboard.headers.get("location")).toBe("http://localhost:3000/login");
    expect(dashboard.cookies.get("better-auth.session_token")?.value).toBe("");
  });

  it("ignores a previously cached session when the login path verifies a revoked token", async () => {
    lookup.rows = [{ userId: "member-1", role: "broker", onboardingStatus: "COMPLETED" }];
    expect((await proxy(request("/dashboard", "recently-revoked-token"))).status).toBe(200);

    lookup.rows = [];
    const login = await proxy(request("/login", "recently-revoked-token"));
    expect(login.status).toBe(200);
    expect(login.cookies.get("better-auth.session_token")?.value).toBe("");
  });

  it("does not erase a session when the lookup is temporarily unavailable", async () => {
    lookup.fails = true;
    const login = await proxy(request("/login", "temporarily-unavailable-token"));
    expect(login.status).toBe(200);
    expect(login.cookies.get("better-auth.session_token")).toBeUndefined();
  });

  it("keeps a valid session redirected to its authenticated area", async () => {
    lookup.rows = [{ userId: "member-2", role: "director", onboardingStatus: "COMPLETED" }];
    const login = await proxy(request("/login", "valid-token"));
    expect(login.headers.get("location")).toBe("http://localhost:3000/dashboard");
    expect(login.cookies.get("better-auth.session_token")).toBeUndefined();
  });

  it("clears the secure cookie and opens admin login after an admin session is revoked", async () => {
    const login = await proxy(request("/admin/login", "revoked-admin-token", "__Secure-better-auth.session_token"));
    expect(login.status).toBe(200);
    expect(login.cookies.get("__Secure-better-auth.session_token")?.value).toBe("");
    expect(login.cookies.get("__Secure-better-auth.session_token")?.secure).toBe(true);

    const admin = await proxy(request("/super-admin", "revoked-admin-token", "__Secure-better-auth.session_token"));
    expect(admin.headers.get("location")).toBe("http://localhost:3000/admin/login");
  });

  it("does not expire a session cookie on the sign-in API response", async () => {
    const signIn = await proxy(request("/api/auth/sign-in/email"));
    expect(signIn.status).toBe(200);
    expect(signIn.cookies.get("better-auth.session_token")).toBeUndefined();
  });

  it("reads the token from the signed cookie Better Auth sets (a fresh sign-in is not sent back to /login)", async () => {
    lookup.rows = [{ userId: "member-3", role: "director", onboardingStatus: "COMPLETED" }];
    const login = await proxy(request("/login", signed("fresh-sign-in-token")));
    expect(login.headers.get("location")).toBe("http://localhost:3000/dashboard");
    const dashboard = await proxy(request("/dashboard", signed("fresh-sign-in-token")));
    expect(dashboard.status).toBe(200);
    expect(dashboard.cookies.get("better-auth.session_token")).toBeUndefined();
  });

  it("sends a revoked signed session to /login once and clears it (no loop)", async () => {
    const dashboard = await proxy(request("/dashboard", signed("deactivated-user-token")));
    expect(dashboard.headers.get("location")).toBe("http://localhost:3000/login");
    expect(dashboard.cookies.get("better-auth.session_token")?.value).toBe("");
    const login = await proxy(request("/login", signed("deactivated-user-token")));
    expect(login.status).toBe(200);
    expect(login.headers.get("location")).toBeNull();
  });

  it("treats a cookie with a wrong signature as revoked", async () => {
    lookup.rows = [{ userId: "member-4", role: "broker", onboardingStatus: "COMPLETED" }];
    const forged = await proxy(request("/dashboard", signed("someone-elses-token", "another-secret")));
    expect(forged.headers.get("location")).toBe("http://localhost:3000/login");
    expect(forged.cookies.get("better-auth.session_token")?.value).toBe("");
  });

  it("parses the signed cookie format", async () => {
    expect(await readSessionToken(signed("abc123"), SECRET)).toBe("abc123");
    expect(await readSessionToken(decodeURIComponent(signed("abc123")), SECRET)).toBe("abc123");
    expect(await readSessionToken(signed("abc123", "other"), SECRET)).toBeNull();
    expect(await readSessionToken("plain-token", SECRET)).toBe("plain-token");
  });
});
