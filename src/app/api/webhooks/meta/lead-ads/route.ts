import { NextResponse } from "next/server";

import { getMetaLeadAdsServerConfig } from "@/features/communication-channels/meta-cloud-config";
import { ingestMetaLeadAdsWebhook, type MetaLeadAdsWebhookPayload, verifyMetaWebhookSignature } from "@/features/communication-channels/meta-lead-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  try {
    const config = getMetaLeadAdsServerConfig();
    const params = new URL(request.url).searchParams;
    if (params.get("hub.mode") !== "subscribe" || !params.get("hub.challenge") || params.get("hub.verify_token") !== config.webhookVerifyToken) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(params.get("hub.challenge")!, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return NextResponse.json({ error: "Webhook de Lead Ads não configurado." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const config = getMetaLeadAdsServerConfig();
    const rawBody = await request.text();
    if (!verifyMetaWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    let payload: MetaLeadAdsWebhookPayload;
    try { payload = JSON.parse(rawBody) as MetaLeadAdsWebhookPayload; } catch { return NextResponse.json({ accepted: true, ignored: "invalid_json" }); }
    const result = await ingestMetaLeadAdsWebhook(payload, rawBody, request);
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    console.error("[Meta Lead Ads webhook] processing failed", error instanceof Error ? error.message.slice(0, 240) : "unknown_error");
    return NextResponse.json({ accepted: false }, { status: 500 });
  }
}
