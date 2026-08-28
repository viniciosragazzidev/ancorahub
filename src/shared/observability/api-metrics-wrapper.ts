/**
 * API route instrumentation wrapper.
 *
 * Wraps any Next.js API route handler to automatically record:
 * - Request duration
 * - Auth/tenant/DB timing from AsyncLocalStorage
 * - Status code
 * - Slow request logging
 *
 * Usage:
 *   export const GET = withApiMetrics(async (request) => { ... });
 */

import { NextResponse } from "next/server";
import { recordApiMetric, logSlowRequest } from "@/shared/observability/metrics";
import { getRequestTiming, getDurations } from "@/shared/observability/request-timing";

type RouteHandler = (
  request: Request,
) => Promise<Response | NextResponse>;

function extractRouteName(pathname: string): string {
  // Normalize dynamic segments: /leads/abc123 → /leads/[id]
  return pathname
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "/[id]")
    .replace(/\/\d+/g, "/[id]")
    .replace(/\/api\//, "");
}

export function withApiMetrics(handler: RouteHandler): RouteHandler {
  // This wrapper is currently used by static Route Handlers only. Keeping its
  // exported signature to a single Request parameter preserves the exact
  // Next.js 16 contract for static routes (whose generated context uses
  // `params: Promise<{}>`).
  return async (request: Request) => {
    const start = performance.now();
    const url = new URL(request.url);
    const route = extractRouteName(url.pathname);
    const method = request.method;

    let status = 200;

    try {
      const response = await handler(request);

      // Extract status from response object
      if (response && typeof response === "object" && "status" in response) {
        status = (response as unknown as { status: number }).status;
      }

      const durationMs = Math.round(performance.now() - start);

      // Get timing from AsyncLocalStorage if available
      const timing = getRequestTiming();
      const durations = timing ? getDurations(timing) : { authMs: 0, tenantMs: 0, dbMs: 0 };

      // Record metric
      recordApiMetric({
        route,
        method,
        status,
        durationMs,
        authMs: durations.authMs,
        tenantMs: durations.tenantMs,
        dbMs: durations.dbMs,
      });

      // Log slow requests
      logSlowRequest({
        requestId: timing?.requestId ?? "unknown",
        route,
        durationMs,
        authMs: durations.authMs,
        tenantMs: durations.tenantMs,
        dbMs: durations.dbMs,
      });

      return response;
    } catch (error) {
      status = 500;
      const durationMs = Math.round(performance.now() - start);

      recordApiMetric({ route, method, status, durationMs });

      logSlowRequest({
        requestId: "error",
        route,
        durationMs,
      });

      throw error;
    }
  };
}
