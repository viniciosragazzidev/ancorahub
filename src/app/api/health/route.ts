import { NextResponse } from "next/server";
import { runHealthChecks, getHealthMatrix } from "@/shared/observability/health-matrix";
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
 * Used by super-dev integrity page and can be used for external monitoring.
 * Does NOT require authentication — it's a system-level endpoint.
 */
export async function GET() {
  try {
    // Run active health checks (database connectivity, etc.)
    const matrix = await runHealthChecks();

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
  } catch (error) {
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
