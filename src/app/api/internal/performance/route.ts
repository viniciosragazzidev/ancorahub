import { NextResponse } from "next/server";
import { recordFrontendMetric } from "@/shared/observability/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/internal/performance
 *
 * Receives Web Vitals and route timing from the frontend via sendBeacon.
 * Stores in the in-memory ring buffer for the health endpoint to read.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { route, metric, value } = body;

    if (!route || !metric || typeof value !== "number") {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Only store valid metric names
    const validMetrics = ["ttfb", "lcp", "inp", "cls", "route_load"];
    if (!validMetrics.includes(metric)) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    recordFrontendMetric({
      route: String(route).slice(0, 100),
      metric: metric as "ttfb" | "lcp" | "inp" | "cls" | "route_load",
      value: Math.round(value),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
