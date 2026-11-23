import { cloudflareClientIp, createRateLimiter, type RateLimitResult } from "@/shared/http/rate-limit";

/**
 * O /formulario não tem login: cada envio vira lead, oferta e mensagem. Limite por visitante (quando a
 * Cloudflare dá o IP) e um teto geral, bem acima de um pico real de campanha.
 */
export const PUBLIC_FORM_LIMITS = {
  perVisitorMinute: { requests: 4, windowMs: 60_000 },
  perVisitorHour: { requests: 12, windowMs: 3_600_000 },
  globalMinute: { requests: 40, windowMs: 60_000 },
  globalHour: { requests: 400, windowMs: 3_600_000 },
} as const;

export function createPublicFormRateLimiter() {
  const visitorMinute = createRateLimiter(PUBLIC_FORM_LIMITS.perVisitorMinute);
  const visitorHour = createRateLimiter(PUBLIC_FORM_LIMITS.perVisitorHour);
  const globalMinute = createRateLimiter(PUBLIC_FORM_LIMITS.globalMinute);
  const globalHour = createRateLimiter(PUBLIC_FORM_LIMITS.globalHour);
  return (visitorIp: string | null, now = Date.now()): RateLimitResult => {
    if (visitorIp) {
      const minute = visitorMinute(visitorIp, now);
      if (!minute.ok) return minute;
      const hour = visitorHour(visitorIp, now);
      if (!hour.ok) return hour;
    }
    const minute = globalMinute("formulario", now);
    if (!minute.ok) return minute;
    return globalHour("formulario", now);
  };
}

const enforce = createPublicFormRateLimiter();

export function checkPublicFormRateLimit(request: Request) {
  return enforce(cloudflareClientIp(request));
}
