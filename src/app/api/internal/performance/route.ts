import { NextResponse } from "next/server";
import { z } from "zod";

import { withApiMetrics } from "@/shared/observability/api-metrics-wrapper";
import { recordFrontendMetric } from "@/shared/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/performance
 *
 * Receives Web Vitals and route timing from the frontend via sendBeacon.
 * Stores in the in-memory ring buffer for the health endpoint to read.
 */
const performanceMetricSchema = z.object({
  route: z.string().min(1).max(160).startsWith("/"),
  metric: z.enum(["ttfb", "lcp", "inp", "cls", "route_load", "route_navigation"]),
  value: z.number().finite().min(0).max(300_000),
});

function telemetryRoute(route: string): string {
  // Performance telemetry must never retain a lead id, phone number, or any
  // other user-provided segment. The first route segment is enough to group
  // the operational surface without storing navigation detail.
  const segment = route.split("/").filter(Boolean)[0];
  return segment?.replace(/[^a-z0-9-]/gi, "") ? `/${segment.replace(/[^a-z0-9-]/gi, "")}` : "/";
}

export const POST = withApiMetrics(async (request: Request) => {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 1_024) {
    return NextResponse.json({ ok: false }, { status: 413 });
  }

  const parsed = performanceMetricSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  recordFrontendMetric({
    route: telemetryRoute(parsed.data.route),
    metric: parsed.data.metric,
    value: Math.round(parsed.data.value),
  });

  return NextResponse.json({ ok: true });
});
