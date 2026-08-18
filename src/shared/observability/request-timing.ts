/**
 * Request timing utilities for performance instrumentation.
 *
 * Each server request carries a lightweight timing state that records
 * how long auth, tenant resolution, and DB operations take.
 *
 * NO PII or tokens are ever logged — only durations and route names.
 */

type TimingEntry = {
  startMs: number;
  endMs?: number;
};

type RequestTiming = {
  requestId: string;
  route?: string;
  auth: TimingEntry;
  tenantQuery: TimingEntry;
  dbTotal: TimingEntry;
};

const WARN_THRESHOLD_MS = 1_000;
const SLOW_THRESHOLD_MS = 3_000;
const CRITICAL_THRESHOLD_MS = 5_000;

/**
 * Minimal request-scoped timing store using AsyncLocalStorage.
 * Falls back gracefully when ALS is unavailable (edge runtime, etc.).
 */
let asyncLocalStorage: import("node:async_hooks").AsyncLocalStorage<RequestTiming> | undefined;

try {
  // Dynamic import to avoid breaking edge runtime or build
  const { AsyncLocalStorage } = require("node:async_hooks") as typeof import("node:async_hooks");
  asyncLocalStorage = new AsyncLocalStorage<RequestTiming>();
} catch {
  // Edge runtime or build phase — timing is best-effort only
}

function generateRequestId(): string {
  // Short random ID — no crypto dependency for perf reasons
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Run a callback within a timing context. Returns the timing record
 * after the callback completes (or throws).
 */
export async function withRequestTiming<T>(
  route: string,
  fn: () => Promise<T>,
): Promise<{ result: T; timing: RequestTiming }> {
  const timing: RequestTiming = {
    requestId: generateRequestId(),
    route,
    auth: { startMs: 0 },
    tenantQuery: { startMs: 0 },
    dbTotal: { startMs: 0 },
  };

  if (!asyncLocalStorage) {
    // Fallback: no ALS available, just run without timing context
    const result = await fn();
    return { result, timing };
  }

  return asyncLocalStorage.run(timing, async () => {
    const result = await fn();
    return { result, timing };
  });
}

/** Get the current request timing from ALS context. Returns undefined if outside context. */
export function getRequestTiming(): RequestTiming | undefined {
  return asyncLocalStorage?.getStore();
}

/** Mark auth phase start */
export function markAuthStart(): void {
  const t = asyncLocalStorage?.getStore();
  if (t) t.auth.startMs = performance.now();
}

/** Mark auth phase end */
export function markAuthEnd(): void {
  const t = asyncLocalStorage?.getStore();
  if (t) t.auth.endMs = performance.now();
}

/** Mark tenant query phase start */
export function markTenantStart(): void {
  const t = asyncLocalStorage?.getStore();
  if (t) t.tenantQuery.startMs = performance.now();
}

/** Mark tenant query phase end */
export function markTenantEnd(): void {
  const t = asyncLocalStorage?.getStore();
  if (t) t.tenantQuery.endMs = performance.now();
}

/** Mark DB total phase start */
export function markDbStart(): void {
  const t = asyncLocalStorage?.getStore();
  if (t) t.dbTotal.startMs = performance.now();
}

/** Mark DB total phase end */
export function markDbEnd(): void {
  const t = asyncLocalStorage?.getStore();
  if (t) t.dbTotal.endMs = performance.now();
}

/** Calculate durations from timing record */
export function getDurations(timing: RequestTiming) {
  const now = performance.now();
  return {
    authMs: timing.auth.endMs != null ? Math.round(timing.auth.endMs - timing.auth.startMs) : (timing.auth.startMs ? Math.round(now - timing.auth.startMs) : 0),
    tenantMs: timing.tenantQuery.endMs != null ? Math.round(timing.tenantQuery.endMs - timing.tenantQuery.startMs) : (timing.tenantQuery.startMs ? Math.round(now - timing.tenantQuery.startMs) : 0),
    dbMs: timing.dbTotal.endMs != null ? Math.round(timing.dbTotal.endMs - timing.dbTotal.startMs) : (timing.dbTotal.startMs ? Math.round(now - timing.dbTotal.startMs) : 0),
  };
}

/** Log a completed request timing. No PII. */
export function logRequestTiming(timing: RequestTiming): void {
  const durations = getDurations(timing);
  const totalMs = Math.round(
    (timing.dbTotal.endMs ?? performance.now()) - timing.auth.startMs,
  );

  const level =
    totalMs > CRITICAL_THRESHOLD_MS
      ? "CRITICAL"
      : totalMs > SLOW_THRESHOLD_MS
        ? "SLOW"
        : totalMs > WARN_THRESHOLD_MS
          ? "WARN"
          : "OK";

  // Only log slow requests to avoid noise
  if (level === "OK") return;

  console.log(
    JSON.stringify({
      type: "request_timing",
      requestId: timing.requestId,
      route: timing.route ?? "unknown",
      level,
      authMs: durations.authMs,
      tenantMs: durations.tenantMs,
      dbMs: durations.dbMs,
      totalMs,
    }),
  );
}

/**
 * Timeout wrapper for async operations.
 * Returns the result or throws a timeout error after `ms` milliseconds.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`TIMEOUT: ${label} exceeded ${ms}ms`));
    }, ms);
  });

  try {
    const result = await Promise.race([promise, timeout]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
