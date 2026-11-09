/**
 * CSRF guard for cookie-authenticated API writes.
 *
 * Server Actions already check the Origin; route handlers under /api do not,
 * and the session cookie is SameSite=Lax, which still lets a sibling
 * subdomain (same site) post with the cookie. A write that carries the
 * session cookie must come from one of our own origins.
 *
 * Fails open only when the browser sends neither Origin nor Sec-Fetch-Site
 * (old browsers, server-to-server calls), which never carry the cookie from a
 * third-party page.
 */
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Bearer-token or signature-checked routes, and better-auth (it checks Origin itself). */
const EXEMPT_PREFIXES = ["/api/auth", "/api/webhooks", "/api/webhook", "/api/extension", "/api/internal/jobs", "/api/internal/cron", "/api/public"];

const CANONICAL_HOSTS = ["crm.ancorasaude.cloud"];

function hostOf(value: string | null | undefined) {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function trustedApiHosts(input: { requestHost: string | null; env?: NodeJS.ProcessEnv }) {
  const env = input.env ?? process.env;
  const hosts = new Set<string>(CANONICAL_HOSTS);
  if (input.requestHost) hosts.add(input.requestHost.toLowerCase());
  for (const value of [env.BETTER_AUTH_URL, env.NEXT_PUBLIC_APP_URL]) {
    const host = hostOf(value);
    if (host) hosts.add(host);
  }
  return hosts;
}

export function needsSameOriginCheck(input: { method: string; pathname: string; hasSessionCookie: boolean }) {
  if (!input.hasSessionCookie) return false;
  if (!MUTATING_METHODS.has(input.method.toUpperCase())) return false;
  if (!input.pathname.startsWith("/api/")) return false;
  return !EXEMPT_PREFIXES.some((prefix) => input.pathname === prefix || input.pathname.startsWith(`${prefix}/`));
}

export function isSameOriginRequest(input: {
  origin: string | null;
  secFetchSite: string | null;
  requestHost: string | null;
  env?: NodeJS.ProcessEnv;
}) {
  const trusted = trustedApiHosts({ requestHost: input.requestHost, env: input.env });
  if (input.origin && input.origin !== "null") {
    const host = hostOf(input.origin);
    return host !== null && trusted.has(host);
  }
  if (input.origin === "null") return false;
  // No Origin header: rely on Fetch Metadata when the browser sends it.
  if (input.secFetchSite) return input.secFetchSite === "same-origin" || input.secFetchSite === "none";
  return true;
}
