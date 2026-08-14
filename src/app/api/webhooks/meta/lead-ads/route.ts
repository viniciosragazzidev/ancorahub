import { NextResponse } from "next/server";

import { getMetaLeadAdsWebhookConfig } from "@/features/communication-channels/meta-cloud-config";
import { ingestMetaLeadAdsWebhook, type MetaLeadAdsWebhookPayload, verifyMetaWebhookSignature } from "@/features/communication-channels/meta-lead-ads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function summarizeWebhookPayload(payload: MetaLeadAdsWebhookPayload) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const pageIds = entries
    .map((entry) => typeof entry?.id === "string" ? entry.id : "")
    .filter((id, index, values) => /^\d{6,30}$/.test(id) && values.indexOf(id) === index)
    .slice(0, 20);
  const fields = entries
    .flatMap((entry) => Array.isArray(entry?.changes) ? entry.changes : [])
    .map((change) => typeof change?.field === "string" ? change.field : "")
    .filter((field, index, values) => field && values.indexOf(field) === index)
    .slice(0, 20);
  return {
    object: typeof payload.object === "string" ? payload.object : null,
    entriesCount: entries.length,
    pageIds,
    fields,
    leadgenEvents: fields.filter((field) => field === "leadgen").length,
  };
}

export async function GET(request: Request) {
  try {
    const config = getMetaLeadAdsWebhookConfig();
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
    const config = getMetaLeadAdsWebhookConfig();
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    console.log("[Meta Lead Ads Webhook POST received]", { bodyLength: rawBody.length, hasSignature: Boolean(signature) });

    if (!verifyMetaWebhookSignature(rawBody, signature, config.appSecret)) {
      console.warn("[Meta Lead Ads Webhook POST] Invalid signature", { hasSignature: Boolean(signature) });
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: MetaLeadAdsWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as MetaLeadAdsWebhookPayload;
    } catch {
      console.warn("[Meta Lead Ads Webhook POST] Invalid JSON payload");
      return NextResponse.json({ accepted: true, ignored: "invalid_json" });
    }

    console.log("[META_WEBHOOK_HTTP_RECEIVED]", summarizeWebhookPayload(payload));
    const result = await ingestMetaLeadAdsWebhook(payload, rawBody, request);
    console.log("[Meta Lead Ads Webhook POST ingest result]", result);
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    console.error("[Meta Lead Ads webhook POST processing failed]", error instanceof Error ? error.stack || error.message : error);
    return NextResponse.json({ accepted: false }, { status: 500 });
  }
}
