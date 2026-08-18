/**
 * Centralized metrics collector for CorreTop.
 *
 * Stores recent metrics in a fixed-size ring buffer to prevent memory growth.
 * Metrics are collected by middleware, DB client, external call wrappers,
 * and frontend components.
 *
 * NO PII is ever stored — only route names, status codes, and durations.
 */

// ─── Types ────────────────────────────────────────────────────────────

export type MetricType = "api" | "db" | "external" | "frontend";

export type ApiMetric = {
  type: "api";
  route: string;
  method: string;
  status: number;
  durationMs: number;
  authMs?: number;
  tenantMs?: number;
  dbMs?: number;
  timestamp: number;
};

export type DbMetric = {
  type: "db";
  operation: string;
  durationMs: number;
  acquireMs?: number;
  queryMs?: number;
  rows?: number;
  error?: boolean;
  timestamp: number;
};

export type ExternalMetric = {
  type: "external";
  provider: "meta" | "openrouter" | "whatsapp" | "vps" | "realtime" | "other";
  operation: string;
  durationMs: number;
  status: "success" | "error" | "timeout";
  timestamp: number;
};

export type FrontendMetric = {
  type: "frontend";
  route: string;
  metric: "ttfb" | "lcp" | "inp" | "cls" | "route_load";
  value: number;
  timestamp: number;
};

export type Metric = ApiMetric | DbMetric | ExternalMetric | FrontendMetric;

// ─── Ring Buffer ──────────────────────────────────────────────────────

const MAX_METRICS = 500;
const metrics: Metric[] = [];
let writeIndex = 0;
let totalCount = 0;

function pushMetric(metric: Metric): void {
  if (metrics.length < MAX_METRICS) {
    metrics.push(metric);
  } else {
    metrics[writeIndex] = metric;
    writeIndex = (writeIndex + 1) % MAX_METRICS;
  }
  totalCount++;
}

// ─── Recording Functions ──────────────────────────────────────────────

export function recordApiMetric(m: Omit<ApiMetric, "type" | "timestamp">): void {
  pushMetric({ ...m, type: "api", timestamp: Date.now() });
}

export function recordDbMetric(m: Omit<DbMetric, "type" | "timestamp">): void {
  pushMetric({ ...m, type: "db", timestamp: Date.now() });
}

export function recordExternalMetric(m: Omit<ExternalMetric, "type" | "timestamp">): void {
  pushMetric({ ...m, type: "external", timestamp: Date.now() });
}

export function recordFrontendMetric(m: Omit<FrontendMetric, "type" | "timestamp">): void {
  pushMetric({ ...m, type: "frontend", timestamp: Date.now() });
}

// ─── Query Functions ──────────────────────────────────────────────────

/** Get all metrics from the last N milliseconds */
export function getRecentMetrics(windowMs: number = 60_000): Metric[] {
  const cutoff = Date.now() - windowMs;
  return metrics.filter((m) => m.timestamp >= cutoff);
}

/** Get only API metrics from the last N ms */
export function getRecentApiMetrics(windowMs: number = 60_000): ApiMetric[] {
  return getRecentMetrics(windowMs).filter((m): m is ApiMetric => m.type === "api");
}

/** Get only DB metrics from the last N ms */
export function getRecentDbMetrics(windowMs: number = 60_000): DbMetric[] {
  return getRecentMetrics(windowMs).filter((m): m is DbMetric => m.type === "db");
}

/** Get only external metrics from the last N ms */
export function getRecentExternalMetrics(windowMs: number = 60_000): ExternalMetric[] {
  return getRecentMetrics(windowMs).filter((m): m is ExternalMetric => m.type === "external");
}

// ─── Statistics ───────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function computeStats(durations: number[]): {
  count: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  avg: number;
} {
  if (durations.length === 0) {
    return { count: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
  }
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: sorted.length,
    p50: Math.round(percentile(sorted, 50)),
    p95: Math.round(percentile(sorted, 95)),
    p99: Math.round(percentile(sorted, 99)),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
  };
}

/** Compute aggregate stats for API requests in a time window */
export function getApiStats(windowMs: number = 60_000) {
  const apiMetrics = getRecentApiMetrics(windowMs);
  const durations = apiMetrics.map((m) => m.durationMs);
  const errors = apiMetrics.filter((m) => m.status >= 500).length;
  const timeouts = apiMetrics.filter((m) => m.status === 408 || m.status === 504).length;

  // Group by route
  const byRoute = new Map<string, { durations: number[]; errors: number; total: number }>();
  for (const m of apiMetrics) {
    const key = m.route || "unknown";
    let entry = byRoute.get(key);
    if (!entry) {
      entry = { durations: [], errors: 0, total: 0 };
      byRoute.set(key, entry);
    }
    entry.durations.push(m.durationMs);
    entry.total++;
    if (m.status >= 500) entry.errors++;
  }

  const slowestRoutes = Array.from(byRoute.entries())
    .map(([route, data]) => ({
      route,
      ...computeStats(data.durations),
      errors: data.errors,
    }))
    .sort((a, b) => b.p95 - a.p95)
    .slice(0, 10);

  return {
    ...computeStats(durations),
    errors,
    timeouts,
    errorRate: apiMetrics.length > 0 ? Math.round((errors / apiMetrics.length) * 10000) / 100 : 0,
    slowestRoutes,
    totalRequests: apiMetrics.length,
  };
}

/** Compute aggregate stats for DB operations */
export function getDbStats(windowMs: number = 60_000) {
  const dbMetrics = getRecentDbMetrics(windowMs);
  const durations = dbMetrics.map((m) => m.durationMs);
  const acquireDurations = dbMetrics.filter((m) => m.acquireMs != null).map((m) => m.acquireMs!);
  const errors = dbMetrics.filter((m) => m.error).length;

  return {
    ...computeStats(durations),
    acquire: computeStats(acquireDurations),
    errors,
    totalQueries: dbMetrics.length,
  };
}

/** Compute aggregate stats for external dependencies */
export function getExternalStats(windowMs: number = 60_000) {
  const extMetrics = getRecentExternalMetrics(windowMs);
  const byProvider = new Map<string, { durations: number[]; errors: number; timeouts: number; total: number }>();

  for (const m of extMetrics) {
    let entry = byProvider.get(m.provider);
    if (!entry) {
      entry = { durations: [], errors: 0, timeouts: 0, total: 0 };
      byProvider.set(m.provider, entry);
    }
    entry.durations.push(m.durationMs);
    entry.total++;
    if (m.status === "error") entry.errors++;
    if (m.status === "timeout") entry.timeouts++;
  }

  const providers = Array.from(byProvider.entries()).map(([provider, data]) => ({
    provider,
    ...computeStats(data.durations),
    errors: data.errors,
    timeouts: data.timeouts,
    total: data.total,
    errorRate: data.total > 0 ? Math.round((data.errors / data.total) * 10000) / 100 : 0,
  }));

  return { providers, totalCalls: extMetrics.length };
}

// ─── Slow Request Log ─────────────────────────────────────────────────

const WARN_THRESHOLD_MS = 1_000;
const SLOW_THRESHOLD_MS = 3_000;
const CRITICAL_THRESHOLD_MS = 5_000;

export type SlowRequestEntry = {
  requestId: string;
  route: string;
  level: "WARN" | "SLOW" | "CRITICAL";
  durationMs: number;
  authMs?: number;
  tenantMs?: number;
  dbMs?: number;
  timestamp: number;
};

const slowRequests: SlowRequestEntry[] = [];
const MAX_SLOW_REQUESTS = 200;
let slowWriteIndex = 0;

/**
 * Log a slow request. Only logs requests above the WARN threshold.
 * Called by middleware after each request completes.
 */
export function logSlowRequest(entry: Omit<SlowRequestEntry, "level" | "timestamp">): void {
  const level =
    entry.durationMs > CRITICAL_THRESHOLD_MS
      ? "CRITICAL"
      : entry.durationMs > SLOW_THRESHOLD_MS
        ? "SLOW"
        : entry.durationMs > WARN_THRESHOLD_MS
          ? "WARN"
          : null;

  if (!level) return; // Not slow enough to log

  const record: SlowRequestEntry = { ...entry, level, timestamp: Date.now() };

  if (slowRequests.length < MAX_SLOW_REQUESTS) {
    slowRequests.push(record);
  } else {
    slowRequests[slowWriteIndex] = record;
    slowWriteIndex = (slowWriteIndex + 1) % MAX_SLOW_REQUESTS;
  }

  // Always log to console for production monitoring
  console.log(
    JSON.stringify({
      type: "slow_request",
      ...record,
    }),
  );
}

/** Get recent slow requests */
export function getSlowRequests(windowMs: number = 300_000): SlowRequestEntry[] {
  const cutoff = Date.now() - windowMs;
  return slowRequests.filter((r) => r.timestamp >= cutoff);
}

// ─── Summary ──────────────────────────────────────────────────────────

export function getMetricsSummary(windowMs: number = 60_000) {
  return {
    windowMs,
    totalMetricsCollected: totalCount,
    bufferSize: metrics.length,
    api: getApiStats(windowMs),
    db: getDbStats(windowMs),
    external: getExternalStats(windowMs),
    slowRequests: getSlowRequests(windowMs).length,
  };
}
