import { type NextRequest, NextResponse } from "next/server";
import { backgroundRoute } from "@/shared/db/background-pool";

export const runtime = "nodejs";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Idempotency-Key, X-Request-Id",
  "Access-Control-Max-Age": "86400",
};

/** Compatibility alias for integrations that used the original singular path. */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function handlePOST(request: NextRequest) {
  const { POST: unifiedPost } = await import("../webhooks/leads/route");
  return unifiedPost(request);
}

// Jobs and webhooks run on their own DB sockets, never the ones serving pages (24/10).
export const POST = backgroundRoute(handlePOST);
