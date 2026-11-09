import { describe, expect, it } from "vitest";

import { isSameOriginRequest, needsSameOriginCheck } from "./same-origin";

const env = { BETTER_AUTH_URL: "https://crm.ancorasaude.cloud" } as unknown as NodeJS.ProcessEnv;

describe("needsSameOriginCheck", () => {
  it("only checks API writes that carry the session cookie", () => {
    expect(needsSameOriginCheck({ method: "POST", pathname: "/api/documents/upload", hasSessionCookie: true })).toBe(true);
    expect(needsSameOriginCheck({ method: "POST", pathname: "/api/documents/upload", hasSessionCookie: false })).toBe(false);
    expect(needsSameOriginCheck({ method: "GET", pathname: "/api/documents/download", hasSessionCookie: true })).toBe(false);
    expect(needsSameOriginCheck({ method: "POST", pathname: "/leads", hasSessionCookie: true })).toBe(false);
  });

  it("never touches webhooks, the extension, jobs, public routes or better-auth", () => {
    for (const pathname of ["/api/webhooks/leads/abc", "/api/webhook", "/api/extension/inbox", "/api/internal/jobs/purge", "/api/public/spreadsheets/x", "/api/auth/sign-in/email"]) {
      expect(needsSameOriginCheck({ method: "POST", pathname, hasSessionCookie: true })).toBe(false);
    }
  });
});

describe("isSameOriginRequest", () => {
  it("accepts our own origin and the request host", () => {
    expect(isSameOriginRequest({ origin: "https://crm.ancorasaude.cloud", secFetchSite: "same-origin", requestHost: "crm.ancorasaude.cloud", env })).toBe(true);
    expect(isSameOriginRequest({ origin: "http://localhost:3000", secFetchSite: "same-origin", requestHost: "localhost:3000", env })).toBe(true);
  });

  it("rejects another site and a sibling subdomain", () => {
    expect(isSameOriginRequest({ origin: "https://evil.example", secFetchSite: "cross-site", requestHost: "crm.ancorasaude.cloud", env })).toBe(false);
    expect(isSameOriginRequest({ origin: "https://staging.crm.ancorasaude.cloud", secFetchSite: "same-site", requestHost: "crm.ancorasaude.cloud", env })).toBe(false);
    expect(isSameOriginRequest({ origin: "null", secFetchSite: "cross-site", requestHost: "crm.ancorasaude.cloud", env })).toBe(false);
  });

  it("without Origin falls back to Fetch Metadata, and stays open for non-browser callers", () => {
    expect(isSameOriginRequest({ origin: null, secFetchSite: "cross-site", requestHost: "crm.ancorasaude.cloud", env })).toBe(false);
    expect(isSameOriginRequest({ origin: null, secFetchSite: "same-origin", requestHost: "crm.ancorasaude.cloud", env })).toBe(true);
    expect(isSameOriginRequest({ origin: null, secFetchSite: null, requestHost: "crm.ancorasaude.cloud", env })).toBe(true);
  });
});
