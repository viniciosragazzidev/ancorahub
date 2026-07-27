import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { getMetaCloudServerConfig } from "@/features/communication-channels/meta-cloud-config";
import { ingestMetaCloudWebhook, isMetaCloudWhatsAppEnabled } from "@/features/communication-channels/service";
import type { MetaWebhookPayload } from "@/features/communication-channels/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function signatureMatches(rawBody: string, signatureHeader: string | null, appSecret: string) {
  const received = signatureHeader?.replace(/^sha256=/, "") ?? "";
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const left = Buffer.from(received, "hex");
  const right = Buffer.from(expected, "hex");
  return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  try {
    const config = getMetaCloudServerConfig();
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");
    if (mode !== "subscribe" || !challenge || token !== config.webhookVerifyToken) return new NextResponse(null, { status: 403 });
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch {
    return NextResponse.json({ error: "Meta webhook não configurado." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const config = getMetaCloudServerConfig();
    const rawBody = await request.text();
    if (!signatureMatches(rawBody, request.headers.get("x-hub-signature-256"), config.appSecret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    if (!(await isMetaCloudWhatsAppEnabled())) return NextResponse.json({ accepted: true, ignored: "feature_disabled" });
    let payload: MetaWebhookPayload;
    try { payload = JSON.parse(rawBody) as MetaWebhookPayload; } catch { return NextResponse.json({ accepted: true, ignored: "invalid_json" }); }
    const result = await ingestMetaCloudWebhook(payload, rawBody);
    return NextResponse.json({ accepted: true, ...result });
  } catch (error) {
    console.error("[Meta WhatsApp webhook] processing failed", error instanceof Error ? error.message : "unknown_error");
    return NextResponse.json({ accepted: false }, { status: 500 });
  }
}
