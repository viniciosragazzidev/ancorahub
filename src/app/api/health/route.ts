import { NextResponse } from "next/server";

import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";
import { isBearerAuthorized } from "@/shared/http/bearer-auth";
import { runHealthChecks } from "@/shared/observability/health-matrix";
import { getMetricsSummary } from "@/shared/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Returns:
 * - Health matrix with status of each dependency (HEALTHY / DEGRADED / DOWN)
 * - Performance metrics summary (p50, p95, p99, error rates)
 * - Slow request count
 *
 * Public callers (uptime monitors) get only the overall status, with the same
 * HTTP codes. Dependency errors, latencies and route names are internal: they
 * need `Authorization: Bearer CRON_SECRET` or a platform admin session.
 */
async function canSeeDetails(request: Request) {
  if (isBearerAuthorized(request, process.env.CRON_SECRET)) return true;
  try {
    await getRequiredPlatformAdmin();
    return true;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  try {
    // Run active health checks (database connectivity, etc.)
    const matrix = await runHealthChecks();
    const overallStatus = matrix.overall === "HEALTHY" ? 200 : 207;

    if (!(await canSeeDetails(request))) {
      return NextResponse.json(
        { status: matrix.overall, timestamp: new Date().toISOString() },
        { status: overallStatus, headers: { "Cache-Control": "no-store", "X-Health-Status": matrix.overall } },
      );
    }

    // Get performance metrics from the in-memory ring buffer
    const metrics = getMetricsSummary(60_000);

    const overallHealthy = matrix.overall === "HEALTHY";

    return NextResponse.json(
      {
        status: matrix.overall,
        timestamp: new Date().toISOString(),
        uptime: matrix.uptime,
        dependencies: matrix.dependencies.map((d) => ({
          name: d.name,
          status: d.status,
          avgDurationMs: d.avgDurationMs,
          errorCount: d.errorCount,
          lastError: d.lastError,
          lastCheckAt: d.lastCheckMs > 0 ? new Date(d.lastCheckMs).toISOString() : null,
        })),
        performance: {
          api: {
            totalRequests: metrics.api.totalRequests,
            p50: metrics.api.p50,
            p95: metrics.api.p95,
            p99: metrics.api.p99,
            errorRate: metrics.api.errorRate,
            slowestRoutes: metrics.api.slowestRoutes.slice(0, 5),
          },
          db: {
            totalQueries: metrics.db.totalQueries,
            p50: metrics.db.p50,
            p95: metrics.db.p95,
            errors: metrics.db.errors,
          },
          external: metrics.external,
          frontend: metrics.frontend,
        },
        slowRequests: metrics.slowRequests,
      },
      {
        status: overallHealthy ? 200 : 207, // 207 Multi-Status for degraded
        headers: {
          "Cache-Control": "no-store",
          "X-Health-Status": matrix.overall,
        },
      },
    );
  } catch {
    return NextResponse.json(
      {
        status: "DOWN",
        error: "Health check failed",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
