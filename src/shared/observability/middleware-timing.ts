/**
 * Middleware timing — lightweight timing for proxy.ts / middleware.
 *
 * Runs at the edge where AsyncLocalStorage isn't available.
 * Records: total request duration, route, status code.
 * Logs slow requests to console for production monitoring.
 */

import { logSlowRequest } from "@/shared/observability/metrics";

const WARN_THRESHOLD_MS = 1_000;
const SLOW_THRESHOLD_MS = 3_000;
const CRITICAL_THRESHOLD_MS = 5_000;

export type MiddlewareTiming = {
  requestId: string;
  startMs: number;
  pathname: string;
};

export function startMiddlewareTiming(pathname: string, requestId: string): MiddlewareTiming {
  return {
    requestId,
    startMs: performance.now(),
    pathname,
  };
}

export function endMiddlewareTiming(timing: MiddlewareTiming, status: number): void {
  const durationMs = Math.round(performance.now() - timing.startMs);

  // Only log slow requests at middleware level
  if (durationMs > WARN_THRESHOLD_MS) {
    const level =
      durationMs > CRITICAL_THRESHOLD_MS
        ? "CRITICAL"
        : durationMs > SLOW_THRESHOLD_MS
          ? "SLOW"
          : "WARN";

    logSlowRequest({
      requestId: timing.requestId,
      route: timing.pathname,
      durationMs,
    });

    // Also log separately for middleware-specific monitoring
    console.log(
      JSON.stringify({
        type: "middleware_timing",
        requestId: timing.requestId,
        route: timing.pathname,
        status,
        durationMs,
        level,
      }),
    );
  }
}
