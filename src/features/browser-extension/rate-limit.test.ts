import { describe, expect, it } from "vitest";
import { createExtensionRateLimiter, extensionRouteKey, ExtensionRateLimitError, EXTENSION_RATE_LIMITS } from "./rate-limit";

describe("limites isolados da extensão", () => {
  it("separa rota e sessão; resolve não consome aceite nem inbox", () => {
    const allow = createExtensionRateLimiter();
    const route = "/api/extension/leads/resolve";
    for (let i = 0; i < EXTENSION_RATE_LIMITS.resolve.requests; i++) allow(route, "session-a", 0);
    expect(() => allow(route, "session-a", 0)).toThrow(ExtensionRateLimitError);
    expect(() => allow(route, "session-b", 0)).not.toThrow();
    expect(() => allow("/api/extension/offers/:id/accept", "session-a", 0)).not.toThrow();
    expect(() => allow("/api/extension/inbox", "session-a", 0)).not.toThrow();
    expect(() => allow(route, "session-a", 60_000)).not.toThrow();
  });

  it("mantém inbox limitado a 200/hora e aceite a 10/minuto", () => {
    for (const [route, count] of [["/api/extension/inbox", 200], ["/api/extension/offers/:id/accept", 10]] as const) {
      const allow = createExtensionRateLimiter();
      for (let i = 0; i < count; i++) allow(route, "session-a", 0);
      expect(() => allow(route, "session-a", 0)).toThrow(ExtensionRateLimitError);
    }
  });

  it("não permite contornar limites trocando IDs de lead ou oferta", () => {
    for (const suffix of ["leads/one/status", "offers/one/accept", "suggestions/one/feedback"]) {
      const first = extensionRouteKey(new Request("https://crm.test/api/extension/" + suffix));
      const second = extensionRouteKey(new Request("https://crm.test/api/extension/" + suffix.replace("one", "two")));
      expect(first).toBe(second);
    }
  });
});
