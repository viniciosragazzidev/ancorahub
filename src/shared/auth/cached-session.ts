import "server-only";

import { TtlCache } from "@/shared/cache/ttl-cache";
import { getAuth } from "./index";

type Session = Awaited<ReturnType<ReturnType<typeof getAuth>["api"]["getSession"]>>;

/**
 * Session lookups (session row + user row) ran on every request, page render
 * and server action — millions of round trips. The result is kept for 30s per
 * session cookie, in this process only: a sign-out or revocation is seen
 * within 30s at most, and an expired session is never served.
 */
const SESSION_CACHE_TTL_MS = 30_000;
const sessionCache = new TtlCache<NonNullable<Session>>(SESSION_CACHE_TTL_MS, 2000);

const SESSION_COOKIE = /(?:^|;\s*)(?:__Secure-)?better-auth\.session_token=([^;]+)/;

export function sessionCacheKey(requestHeaders: Headers) {
  return requestHeaders.get("cookie")?.match(SESSION_COOKIE)?.[1] ?? null;
}

export async function getCachedSession(requestHeaders: Headers): Promise<Session> {
  const key = sessionCacheKey(requestHeaders);
  const load = () => getAuth().api.getSession({ headers: requestHeaders, query: { disableCookieCache: true } });
  if (!key) return load();
  const cached = sessionCache.get(key);
  if (cached && new Date(cached.session.expiresAt).getTime() > Date.now()) return cached;
  const session = await load();
  if (session) sessionCache.set(key, session);
  else sessionCache.delete(key);
  return session;
}

/** Drops the cached session of a cookie (sign-out). */
export function forgetCachedSession(requestHeaders: Headers) {
  const key = sessionCacheKey(requestHeaders);
  if (key) sessionCache.delete(key);
}
