import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for the container orchestrator.
 *
 * This endpoint deliberately does not query Supabase, Meta, or any other
 * dependency. A temporary dependency backlog must not make Coolify remove a
 * still-running CRM process from its reverse proxy. Dependency readiness stays
 * available at /api/health for observability and alerts.
 */
export function GET() {
  return NextResponse.json(
    { status: "alive", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
