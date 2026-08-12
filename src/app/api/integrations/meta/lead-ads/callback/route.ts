import { NextRequest, NextResponse } from "next/server";

import { completeMetaConnectionAttempt } from "@/features/meta-ads/meta-connection-attempts";
import { MetaGraphClient } from "@/features/meta-ads/meta-graph-client";
import { exchangeCodeForLongLivedToken } from "@/features/meta-ads/meta-oauth";

function popupResponse(input: { origin: string; type: "META_MARKETING_AUTH_SUCCESS" | "META_MARKETING_AUTH_ERROR"; attemptId?: string }) {
  const payload = JSON.stringify(input.type === "META_MARKETING_AUTH_SUCCESS"
    ? { type: input.type, attemptId: input.attemptId }
    : { type: input.type });
  return new NextResponse(`<!doctype html><html><body><script>window.opener?.postMessage(${payload}, ${JSON.stringify(input.origin)});window.close();</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const redirectUri = process.env.META_LEAD_ADS_REDIRECT_URI?.trim() || `${request.nextUrl.origin}/api/integrations/meta/lead-ads/callback`;
  const origin = new URL(redirectUri).origin;
  if (!code || !state) return popupResponse({ origin, type: "META_MARKETING_AUTH_ERROR" });
  try {
    const token = await exchangeCodeForLongLivedToken(code, redirectUri);
    const assets = await new MetaGraphClient(token.accessToken).discoverAssets();
    const attempt = await completeMetaConnectionAttempt({ state, accessToken: token.accessToken, assets, tokenExpiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null });
    return popupResponse({ origin, type: "META_MARKETING_AUTH_SUCCESS", attemptId: attempt.id });
  } catch {
    return popupResponse({ origin, type: "META_MARKETING_AUTH_ERROR" });
  }
}
