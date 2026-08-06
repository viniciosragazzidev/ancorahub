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
    console.log("[Meta Lead Ads Webhook GET]", { mode: params.get("hub.mode"), verifyTokenMatch: params.get("hub.verify_token") === config.webhookVerifyToken });
    if (params.get("hub.mode") !== "subscribe" || !params.get("hub.challenge") || params.get("hub.verify_token") !== config.webhookVerifyToken) {
      return new NextResponse(null, { status: 403 });
    }
    return new NextResponse(params.get("hub.challenge")!, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    console.error("[Meta Lead Ads Webhook GET Error]", error);
    return NextResponse.json({ error: "Webhook de Lead Ads não configurado." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const config = getMetaLeadAdsServerConfig();
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    console.log("[Meta Lead Ads Webhook POST received]", { bodyLength: rawBody.length, hasSignature: Boolean(signature) });

    if (config.appSecret && !verifyMetaWebhookSignature(rawBody, signature, config.appSecret)) {
      console.warn("[Meta Lead Ads Webhook POST] Invalid signature:", { signature });
      if (process.env.NODE_ENV === "production" && signature) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    let payload: MetaLeadAdsWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as MetaLeadAdsWebhookPayload;
    } catch {
      console.warn("[Meta Lead Ads Webhook POST] Invalid JSON payload");
      return NextResponse.json({ accepted: true, ignored: "invalid_json" });
    }

    console.log("[Meta Lead Ads Webhook POST payload]", { object: payload.object, entriesCount: payload.entry?.length ?? 0 });
    const result = await ingestMetaLeadAdsWebhook(payload, rawBody, request);
    console.log("[Meta Lead Ads Webhook POST ingest result]", result);
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    console.error("[Meta Lead Ads webhook POST processing failed]", error instanceof Error ? error.stack || error.message : error);
    return NextResponse.json({ accepted: false }, { status: 500 });
  }
}
