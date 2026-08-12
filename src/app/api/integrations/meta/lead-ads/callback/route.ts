import { NextRequest, NextResponse } from "next/server";

import { completeMetaConnectionAttempt } from "@/features/meta-ads/meta-connection-attempts";
import { MetaGraphClient } from "@/features/meta-ads/meta-graph-client";
import { exchangeCodeForLongLivedToken } from "@/features/meta-ads/meta-oauth";

type MarketingCallbackErrorCode = "missing_parameters" | "token_exchange_failed" | "asset_discovery_failed" | "authorization_persist_failed";

function popupResponse(input: {
  origin: string;
  type: "META_MARKETING_AUTH_SUCCESS" | "META_MARKETING_AUTH_ERROR";
  attemptId?: string;
  errorCode?: MarketingCallbackErrorCode;
}) {
  const payload = JSON.stringify(input.type === "META_MARKETING_AUTH_SUCCESS"
    ? { type: input.type, attemptId: input.attemptId }
    : { type: input.type, errorCode: input.errorCode });
  return new NextResponse(`<!doctype html><html><body><script>window.opener?.postMessage(${payload}, ${JSON.stringify(input.origin)});window.close();</script></body></html>`, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const redirectUri = process.env.META_LEAD_ADS_REDIRECT_URI?.trim() || `${request.nextUrl.origin}/api/integrations/meta/lead-ads/callback`;
  const origin = new URL(redirectUri).origin;
  if (!code || !state) {
    return popupResponse({ origin, type: "META_MARKETING_AUTH_ERROR", errorCode: "missing_parameters" });
  }

  let stage: Exclude<MarketingCallbackErrorCode, "missing_parameters"> = "token_exchange_failed";
  try {
    const token = await exchangeCodeForLongLivedToken(code, redirectUri);
    stage = "asset_discovery_failed";
    const assets = await new MetaGraphClient(token.accessToken).discoverAssets();
    stage = "authorization_persist_failed";
    const attempt = await completeMetaConnectionAttempt({ state, accessToken: token.accessToken, assets, tokenExpiresAt: token.expiresIn ? new Date(Date.now() + token.expiresIn * 1000) : null });
    console.info("[meta-marketing-oauth-callback] authorization_verified", { attemptId: attempt.id });
    return popupResponse({ origin, type: "META_MARKETING_AUTH_SUCCESS", attemptId: attempt.id });
  } catch (error) {
    console.error("[meta-marketing-oauth-callback] authorization_failed", {
      stage,
      errorName: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message.slice(0, 180) : "Unknown error",
    });
    return popupResponse({ origin, type: "META_MARKETING_AUTH_ERROR", errorCode: stage });
  }
}
