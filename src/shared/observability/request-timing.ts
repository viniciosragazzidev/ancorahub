/**
 * Request-scoped, opt-in performance diagnostics. SQL, bind values, cookies,
 * tenant IDs and user IDs are never logged by this module.
 */
import "server-only";

import { createHash } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";
import { setDbQueryHook } from "./db-hook";

type TimingEntry = { startMs: number; endMs?: number };
type RequestTiming = {
  requestId: string;
  route: string;
  sampled: boolean;
  requestStartMs: number;
  activeSpans: number;
  queryCount: number;
  queryFingerprints: Set<string>;
  auth: TimingEntry;
  tenantQuery: TimingEntry;
  dbTotal: TimingEntry;
};
type PerfSpanFields = Record<string, boolean | number | string | undefined>;

const WARN_THRESHOLD_MS = 1_000;
const storage = new AsyncLocalStorage<RequestTiming>();

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sampleRate(): number {
  const value = Number(process.env.PERF_DIAGNOSTICS_SAMPLE_RATE);
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
}

export function isPerfDiagnosticsEnabled(): boolean {
  return process.env.PERF_DIAGNOSTICS === "true";
}

function emit(span: string, timing: RequestTiming, startedAt: number, fields: PerfSpanFields = {}): void {
  if (!timing.sampled) return;
  console.info(JSON.stringify({
    type: "perf_span",
    requestId: timing.requestId,
    route: timing.route,
    span,
    durationMs: Math.round(performance.now() - startedAt),
    ...fields,
  }));
}

/** Wrap a page render, Route Handler, or Server Action. */
export async function withRequestTiming<T>(
  route: string,
  fn: () => Promise<T>,
  requestId?: string | null,
): Promise<{ result: T; timing: RequestTiming }> {
  const timing: RequestTiming = {
    requestId: requestId || generateRequestId(),
    route,
    sampled: isPerfDiagnosticsEnabled() && Math.random() < sampleRate(),
    requestStartMs: performance.now(),
    activeSpans: 0,
    queryCount: 0,
    queryFingerprints: new Set<string>(),
    auth: { startMs: 0 },
    tenantQuery: { startMs: 0 },
    dbTotal: { startMs: 0 },
  };

  return storage.run(timing, async () => {
    try {
      const result = await fn();
      emit("request.total", timing, timing.requestStartMs, { outcome: "success", dbQueryCount: timing.queryCount, dbQueryShapes: timing.queryFingerprints.size });
      return { result, timing };
    } catch (error) {
      emit("request.total", timing, timing.requestStartMs, { outcome: "error", dbQueryCount: timing.queryCount, dbQueryShapes: timing.queryFingerprints.size });
      throw error;
    }
  });
}

/** Times a safe logical operation. `parallel` exposes concurrent fan-out. */
export async function withPerfSpan<T>(span: string, fn: () => Promise<T>, fields: PerfSpanFields = {}): Promise<T> {
  const timing = storage.getStore();
  if (!timing?.sampled) return fn();
  const startedAt = performance.now();
  const parallel = timing.activeSpans > 0;
  timing.activeSpans += 1;
  try {
    const result = await fn();
    emit(span, timing, startedAt, { ...fields, parallel });
    return result;
  } catch (error) {
    emit(span, timing, startedAt, { ...fields, parallel, outcome: "error" });
    throw error;
  } finally {
    timing.activeSpans -= 1;
  }
}

/** Server Actions post back to the current route, so action names disambiguate them in traces. */
export async function withServerActionTiming<T>(route: string, action: string, fn: () => Promise<T>): Promise<T> {
  const { result } = await withRequestTiming(route, () => withPerfSpan("server_action.total", fn, { action }));
  return result;
}

/** postgres.js invokes this at statement issue time; query text is hashed then discarded. */
export function recordIssuedDatabaseQuery(query: string): void {
  const timing = storage.getStore();
  if (!timing?.sampled) return;
  timing.queryCount += 1;
  timing.queryFingerprints.add(createHash("sha256").update(query).digest("hex").slice(0, 12));
}

// Wire up the real hook so db/client.ts (which imports db-hook.ts, not this file)
// still counts queries in the full server context. db-hook.ts defaults to a no-op;
// this call replaces it when the server loads request-timing.ts.
setDbQueryHook(recordIssuedDatabaseQuery);

/** Get the current request timing from ALS context. */
export function getRequestTiming(): RequestTiming | undefined {
  return storage.getStore();
}

/** Mark auth phase start */
export function markAuthStart(): void {
  const t = storage.getStore();
  if (t) t.auth.startMs = performance.now();
}

/** Mark auth phase end */
export function markAuthEnd(): void {
  const t = storage.getStore();
  if (t) t.auth.endMs = performance.now();
}

/** Mark tenant query phase start */
export function markTenantStart(): void {
  const t = storage.getStore();
  if (t) t.tenantQuery.startMs = performance.now();
}

/** Mark tenant query phase end */
export function markTenantEnd(): void {
  const t = storage.getStore();
  if (t) t.tenantQuery.endMs = performance.now();
}

/** Mark DB total phase start */
export function markDbStart(): void {
  const t = storage.getStore();
  if (t) t.dbTotal.startMs = performance.now();
}

/** Mark DB total phase end */
export function markDbEnd(): void {
  const t = storage.getStore();
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
  const totalMs = Math.round(performance.now() - timing.requestStartMs);
  if (totalMs < WARN_THRESHOLD_MS || !timing.sampled) return;
  const durations = getDurations(timing);
  console.info(JSON.stringify({ type: "request_timing", requestId: timing.requestId, route: timing.route, authMs: durations.authMs, tenantMs: durations.tenantMs, dbMs: durations.dbMs, totalMs }));
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
