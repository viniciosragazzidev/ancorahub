import { beforeEach, describe, expect, it, vi } from "vitest";

const { startMetaMarketingConnection } = vi.hoisted(() => ({ startMetaMarketingConnection: vi.fn() }));

vi.mock("@/features/meta-ads/meta-marketing-connection-service", () => ({ startMetaMarketingConnection }));
vi.mock("@/shared/auth/errors", () => ({
  AuthenticationError: class AuthenticationError extends Error { code = "UNAUTHENTICATED"; },
  AuthorizationError: class AuthorizationError extends Error { code = "ACCESS_DENIED"; },
}));

import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { POST } from "./route";

describe("POST /api/integrations/meta/marketing/attempt", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates exactly one authorization attempt and returns only its browser state", async () => {
    startMetaMarketingConnection.mockResolvedValue({ id: "attempt-1", state: "browser-oauth-state" });
    const response = await POST();
    expect(startMetaMarketingConnection).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ state: "browser-oauth-state" });
  });

  it("returns a recoverable session error without exposing internals", async () => {
    startMetaMarketingConnection.mockRejectedValue(new AuthenticationError("session missing"));
    const response = await POST();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHENTICATED", message: "Sua sessão expirou. Entre novamente para conectar a Meta." });
  });

  it("returns an explicit permission error", async () => {
    startMetaMarketingConnection.mockRejectedValue(new AuthorizationError("denied"));
    const response = await POST();
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("ACCESS_DENIED");
  });

  it("does not leak an infrastructure error", async () => {
    startMetaMarketingConnection.mockRejectedValue(new Error('relation "meta_connection_attempts" does not exist'));
    const response = await POST();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ code: "META_CONNECTION_START_FAILED", message: "Não foi possível preparar a conexão com a Meta. Tente novamente." });
  });
});
