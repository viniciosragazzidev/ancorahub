/**
 * Middleware-safe hook for observing database queries.
 *
 * This module has NO `import "server-only"` and NO Node.js-specific APIs
 * (no AsyncLocalStorage, no crypto) so it can be imported by proxy.ts (Next.js
 * Proxy / former Middleware) and by db/client.ts without breaking the
 * Turbopack middleware bundle.
 *
 * The full diagnostics implementation in `request-timing.ts` registers itself
 * here at module-load time when running in the full Node.js server context.
 */

type DbQueryHook = (query: string) => void;

// Use globalThis so the hook survives HMR reloads and is shared across
// module instances within the same process.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as Record<string, unknown>;
g["__ancorahub_dbQueryHook"] ??= (_q: string): void => {
  // Default no-op: replaced by request-timing.ts when loaded in server context
};

/**
 * Registers the real DB query hook. Called once by request-timing.ts on load.
 * Safe to call multiple times (last-write wins, consistent across restarts).
 */
export function setDbQueryHook(hook: DbQueryHook): void {
  g["__ancorahub_dbQueryHook"] = hook;
}

/**
 * Invoked by db/client.ts for every SQL statement issued.
 * No-op until request-timing.ts has been loaded and registered its hook.
 */
export function callDbQueryHook(query: string): void {
  (g["__ancorahub_dbQueryHook"] as DbQueryHook)(query);
}
