import { cloudflareClientIp, createRateLimiter, type RateLimitResult } from "@/shared/http/rate-limit";

/**
 * The landing-page token is public (it sits in the page HTML), so anyone can
 * copy it and post leads. Each lead triggers distribution, offers and
 * WhatsApp messages, so volume is capped per credential and, when Cloudflare
 * gives the visitor IP, per visitor. Sized well above a real campaign peak.
 */
export const LEAD_WEBHOOK_LIMITS = {
  perCredentialMinute: { requests: 60, windowMs: 60_000 },
  perCredentialHour: { requests: 600, windowMs: 3_600_000 },
  perVisitorMinute: { requests: 10, windowMs: 60_000 },
} as const;

export function createLeadWebhookRateLimiter() {
  const minute = createRateLimiter(LEAD_WEBHOOK_LIMITS.perCredentialMinute);
  const hour = createRateLimiter(LEAD_WEBHOOK_LIMITS.perCredentialHour);
  const visitor = createRateLimiter(LEAD_WEBHOOK_LIMITS.perVisitorMinute);
  return (input: { credentialId: string; visitorIp: string | null }, now = Date.now()): RateLimitResult => {
    if (input.visitorIp) {
      const byVisitor = visitor(`${input.credentialId}:${input.visitorIp}`, now);
      if (!byVisitor.ok) return byVisitor;
    }
    const byMinute = minute(input.credentialId, now);
    if (!byMinute.ok) return byMinute;
    return hour(input.credentialId, now);
  };
}

const enforceLeadWebhookRateLimit = createLeadWebhookRateLimiter();

export function checkLeadWebhookRateLimit(request: Request, credentialId: string) {
  return enforceLeadWebhookRateLimit({ credentialId, visitorIp: cloudflareClientIp(request) });
}
