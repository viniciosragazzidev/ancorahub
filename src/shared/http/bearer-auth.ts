import { createHash, timingSafeEqual } from "node:crypto";

/**
 * `Authorization: Bearer <secret>` check for scheduled jobs and internal
 * calls. Compares fixed-length digests in constant time, so response timing
 * says nothing about how much of the secret matched. A missing secret always
 * fails closed.
 */
export function isBearerAuthorized(request: Request, secret: string | null | undefined) {
  const expected = secret?.trim();
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return false;
  const provided = header.slice("Bearer ".length);
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(provided), digest(expected));
}
