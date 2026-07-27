import { type NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  const { POST: unifiedPost } = await import("../webhooks/leads/route");
  return unifiedPost(request);
}
