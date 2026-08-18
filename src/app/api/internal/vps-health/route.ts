import { NextResponse } from "next/server";

import { getVpsHealth } from "@/lib/server/vps-api";
import { AuthenticationError, AuthorizationError } from "@/shared/auth/errors";
import { getRequiredPlatformAdmin } from "@/shared/auth/platform-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getRequiredPlatformAdmin();
    const health = await getVpsHealth();

    if (health.status === "online") {
      return NextResponse.json(
        { reachable: true, latencyMs: health.latencyMs, vps: { status: "ok", service: health.service } },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { reachable: false, latencyMs: health.latencyMs, error: health.errorCode.toUpperCase() },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof AuthenticationError ? 401 : error instanceof AuthorizationError ? 403 : 500;
    const errorCode = error instanceof AuthenticationError ? "UNAUTHENTICATED" : error instanceof AuthorizationError ? "ACCESS_DENIED" : "UNAVAILABLE";
    return NextResponse.json({ error: errorCode }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
