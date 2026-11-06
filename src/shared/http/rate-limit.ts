/**
 * Sliding-window limiter kept in this process's memory. Coolify runs one Node
 * instance today; with more instances each one counts separately, so the real
 * ceiling becomes limit × instances (a shared store is needed then).
 */
export type RateLimit = { requests: number; windowMs: number };
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

export function createRateLimiter(limit: RateLimit) {
  const buckets = new Map<string, number[]>();
  let nextCleanup = 0;
  return function hit(key: string, now = Date.now()): RateLimitResult {
    if (now >= nextCleanup) {
      for (const [bucketKey, stamps] of buckets) {
        if (!stamps.some((at) => now - at < limit.windowMs)) buckets.delete(bucketKey);
      }
      nextCleanup = now + 60_000;
    }
    const recent = (buckets.get(key) ?? []).filter((at) => now - at < limit.windowMs);
    if (recent.length >= limit.requests) {
      buckets.set(key, recent);
      return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((recent[0]! + limit.windowMs - now) / 1000)) };
    }
    recent.push(now);
    buckets.set(key, recent);
    return { ok: true };
  };
}

/**
 * Visitor IP only when Cloudflare supplies it. Behind the proxy chain the last
 * X-Forwarded-For hop can be a Cloudflare edge shared by many visitors, so a
 * per-IP limit on it would block real people; without `cf-connecting-ip` the
 * caller skips the per-IP limit.
 */
export function cloudflareClientIp(request: Request) {
  const ip = request.headers.get("cf-connecting-ip")?.trim();
  return ip ? ip : null;
}
