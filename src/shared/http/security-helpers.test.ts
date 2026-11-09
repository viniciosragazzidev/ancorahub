import { describe, expect, it } from "vitest";

import { buildFallbackAvatarSvg, parseAvatarSize, parseAvatarStyle } from "@/app/api/avatar/[seed]/avatar-svg";
import { createLeadWebhookRateLimiter, LEAD_WEBHOOK_LIMITS } from "@/features/leads/webhooks/services/lead-webhook-rate-limit";
import { isBearerAuthorized } from "./bearer-auth";
import { exceedsBodyLimit } from "./body-limit";
import { createRateLimiter } from "./rate-limit";
import { isInlineSafeMime, safeFileHeaders } from "./safe-file-headers";

describe("avatar SVG", () => {
  it("never lets size or style reach the markup unvalidated", () => {
    expect(parseAvatarSize('"><script>alert(1)</script>')).toBe(128);
    expect(parseAvatarSize("9999")).toBe(128);
    expect(parseAvatarSize("64")).toBe(64);
    expect(parseAvatarStyle("inexistente")).toBe("lorelei");
    const svg = buildFallbackAvatarSvg('<img src=x onerror=alert(1)> "x"', 64);
    expect(svg).not.toMatch(/<img|onerror|script/i);
  });
});

describe("safeFileHeaders", () => {
  it("downloads script-capable types as opaque attachments", () => {
    for (const mime of ["text/html", "image/svg+xml", "application/xhtml+xml", "text/xml", "application/javascript", null]) {
      const headers = safeFileHeaders({ mimeType: mime, filename: "a.html" });
      expect(headers["Content-Type"]).toBe("application/octet-stream");
      expect(headers["Content-Disposition"]).toMatch(/^attachment;/);
      expect(headers["Content-Security-Policy"]).toContain("sandbox");
    }
  });

  it("keeps images, audio, video and PDF inline", () => {
    expect(isInlineSafeMime("image/jpeg")).toBe(true);
    expect(isInlineSafeMime("audio/ogg; codecs=opus")).toBe(true);
    expect(isInlineSafeMime("video/mp4")).toBe(true);
    const pdf = safeFileHeaders({ mimeType: "application/pdf", filename: "proposta.pdf" });
    expect(pdf["Content-Disposition"]).toMatch(/^inline;/);
    expect(pdf).not.toHaveProperty("Content-Security-Policy");
  });

  it("strips header-breaking characters from the filename", () => {
    const headers = safeFileHeaders({ mimeType: "image/png", filename: 'foto"\r\nX-Evil: 1.png' });
    expect(headers["Content-Disposition"]).not.toMatch(/[\r\n]/);
    expect(headers["Content-Disposition"]).toContain("filename*=UTF-8''");
  });
});

describe("isBearerAuthorized", () => {
  const req = (auth?: string) => new Request("https://x.test", { headers: auth ? { authorization: auth } : {} });
  it("accepts only the exact secret and fails closed without one", () => {
    expect(isBearerAuthorized(req("Bearer s3cr3t"), "s3cr3t")).toBe(true);
    expect(isBearerAuthorized(req("Bearer s3cr3"), "s3cr3t")).toBe(false);
    expect(isBearerAuthorized(req(), "s3cr3t")).toBe(false);
    expect(isBearerAuthorized(req("Bearer "), "")).toBe(false);
    expect(isBearerAuthorized(req("Bearer anything"), undefined)).toBe(false);
  });
});

describe("rate limits", () => {
  it("sliding window blocks after the limit and reopens after the window", () => {
    const hit = createRateLimiter({ requests: 2, windowMs: 1_000 });
    expect(hit("k", 0).ok).toBe(true);
    expect(hit("k", 10).ok).toBe(true);
    const blocked = hit("k", 20);
    expect(blocked.ok).toBe(false);
    expect(hit("k", 1_011).ok).toBe(true);
  });

  it("lead webhook caps one visitor before the whole credential", () => {
    const limit = createLeadWebhookRateLimiter();
    for (let i = 0; i < LEAD_WEBHOOK_LIMITS.perVisitorMinute.requests; i++) {
      expect(limit({ credentialId: "c", visitorIp: "1.1.1.1" }, 0).ok).toBe(true);
    }
    expect(limit({ credentialId: "c", visitorIp: "1.1.1.1" }, 0).ok).toBe(false);
    expect(limit({ credentialId: "c", visitorIp: "2.2.2.2" }, 0).ok).toBe(true);
  });

  it("lead webhook without visitor IP is capped per credential", () => {
    const limit = createLeadWebhookRateLimiter();
    for (let i = 0; i < LEAD_WEBHOOK_LIMITS.perCredentialMinute.requests; i++) {
      expect(limit({ credentialId: "c", visitorIp: null }, 0).ok).toBe(true);
    }
    expect(limit({ credentialId: "c", visitorIp: null }, 0).ok).toBe(false);
    expect(limit({ credentialId: "other", visitorIp: null }, 0).ok).toBe(true);
  });
});

describe("exceedsBodyLimit", () => {
  it("rejects declared bodies above the limit", () => {
    expect(exceedsBodyLimit(new Request("https://x.test", { method: "POST", headers: { "content-length": "2000000" } }))).toBe(true);
    expect(exceedsBodyLimit(new Request("https://x.test", { method: "POST", headers: { "content-length": "100" } }))).toBe(false);
  });
});
